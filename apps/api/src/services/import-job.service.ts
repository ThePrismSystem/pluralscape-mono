import { importJobs } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  IMPORT_CHECKPOINT_SCHEMA_VERSION,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  CreateImportJobBodySchema,
  ImportCheckpointStateSchema,
  ImportErrorSchema,
  ImportJobQuerySchema,
  UpdateImportJobBodySchema,
} from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod/v4";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
} from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult, parseCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  ImportCheckpointState,
  ImportCollectionType,
  ImportError,
  ImportJobId,
  ImportJobStatus,
  ImportSourceFormat,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface ImportJobResult {
  readonly id: ImportJobId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  readonly status: ImportJobStatus;
  readonly progressPercent: number;
  readonly errorLog: readonly ImportError[] | null;
  readonly warningCount: number;
  readonly chunksTotal: number | null;
  readonly chunksCompleted: number;
  readonly checkpointState: ImportCheckpointState | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
}

interface ListImportJobOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: ImportJobStatus;
  readonly source?: ImportSourceFormat;
}

// ── JSONB read validators ────────────────────────────────────────────
// Every read of a JSONB column goes through these helpers. Corrupt rows
// (schema drift, stale worker writes, manual SQL) surface as structured
// INTERNAL_ERROR responses rather than returning silently-wrong data.

const ImportErrorLogSchema = z.array(ImportErrorSchema).nullable();

function parseErrorLog(raw: unknown): readonly ImportError[] | null {
  if (raw === null || raw === undefined) return null;
  const result = ImportErrorLogSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiHttpError(
      HTTP_INTERNAL_SERVER_ERROR,
      "INTERNAL_ERROR",
      "Corrupt import job error log",
      { reason: "corrupt_error_log", issues: result.error.issues },
    );
  }
  return result.data;
}

function parseCheckpointState(raw: unknown): ImportCheckpointState | null {
  if (raw === null || raw === undefined) return null;
  const result = ImportCheckpointStateSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiHttpError(
      HTTP_INTERNAL_SERVER_ERROR,
      "INTERNAL_ERROR",
      "Corrupt import checkpoint state",
      { reason: "corrupt_checkpoint_state", issues: result.error.issues },
    );
  }
  return result.data;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toImportJobResult(row: typeof importJobs.$inferSelect): ImportJobResult {
  return {
    id: brandId<ImportJobId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    systemId: brandId<SystemId>(row.systemId),
    source: row.source,
    status: row.status,
    progressPercent: row.progressPercent,
    errorLog: parseErrorLog(row.errorLog),
    warningCount: row.warningCount,
    chunksTotal: row.chunksTotal,
    chunksCompleted: row.chunksCompleted,
    checkpointState: parseCheckpointState(row.checkpointState),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
  };
}

// ── UPDATE constants & helpers ───────────────────────────────────────

const TERMINAL_STATUSES: ReadonlySet<ImportJobStatus> = new Set(["completed", "failed"]);

/** Allowed status transitions for an import job.
 *  - `pending`: initial state; can move forward or fail.
 *  - `validating`: pre-flight checks; can proceed or fail.
 *  - `importing`: active work; self-loop for progress, terminal on success/failure.
 *  - `failed`: resumable only if the last error is fatal+recoverable.
 *  - `completed`: fully terminal.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ImportJobStatus, readonly ImportJobStatus[]>> = {
  pending: ["pending", "validating", "importing", "failed"],
  validating: ["validating", "importing", "failed"],
  importing: ["importing", "completed", "failed"],
  failed: ["validating", "importing"],
  completed: [],
};

/** Canonical order for deciding which collection to start on when seeding
 *  the initial checkpoint. First TRUE entry in this order wins.
 *
 *  `satisfies readonly ImportCollectionType[]` catches membership drift if
 *  `ImportCollectionType` gains a value that isn't listed here — TypeScript
 *  will complain at this declaration rather than at a distant caller. */
const CANONICAL_COLLECTION_ORDER = [
  "member",
  "group",
  "fronting-session",
  "switch",
  "custom-field",
  "note",
  "chat-message",
  "board-message",
  "poll",
  "timer",
  "privacy-bucket",
] as const satisfies readonly ImportCollectionType[];

function firstSelectedCollection(
  selected: Partial<Record<ImportCollectionType, boolean>>,
): ImportCollectionType {
  for (const collection of CANONICAL_COLLECTION_ORDER) {
    if (selected[collection] === true) return collection;
  }
  // Zod .refine() already rejects empty category maps; this is defensive.
  throw new ApiHttpError(
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "At least one category must be selected",
  );
}

function isResumableFromFailed(errorLog: readonly ImportError[] | null): boolean {
  if (!errorLog || errorLog.length === 0) return false;
  const last = errorLog[errorLog.length - 1];
  if (!last) return false;
  return last.fatal && last.recoverable;
}

function pickAuditEventType(
  from: ImportJobStatus,
  to: ImportJobStatus,
): "import-job.updated" | "import-job.completed" | "import-job.failed" {
  if (from !== to && to === "completed") return "import-job.completed";
  if (from !== to && to === "failed") return "import-job.failed";
  return "import-job.updated";
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);
  const parseResult = CreateImportJobBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body", {
      issues: parseResult.error.issues,
    });
  }
  const parsed = parseResult.data;

  const id = createId(ID_PREFIXES.importJob);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const initialCheckpoint: ImportCheckpointState = {
      schemaVersion: IMPORT_CHECKPOINT_SCHEMA_VERSION,
      checkpoint: {
        completedCollections: [],
        currentCollection: firstSelectedCollection(parsed.selectedCategories),
        currentCollectionLastSourceId: null,
        realPrivacyBucketsMapped: false,
      },
      options: {
        selectedCategories: parsed.selectedCategories,
        avatarMode: parsed.avatarMode,
      },
      totals: { perCollection: {} },
    };

    const [row] = await tx
      .insert(importJobs)
      .values({
        id,
        accountId: auth.accountId,
        systemId,
        source: parsed.source,
        status: "pending",
        progressPercent: 0,
        warningCount: 0,
        chunksCompleted: 0,
        checkpointState: initialCheckpoint,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create import job — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "import-job.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Import job created (source: ${parsed.source})`,
      systemId,
    });

    return toImportJobResult(row);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  id: ImportJobId,
  auth: AuthContext,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    return toImportJobResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listImportJobs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListImportJobOpts,
): Promise<PaginatedResult<ImportJobResult>> {
  assertSystemOwnership(systemId, auth);
  const parsedQuery = ImportJobQuerySchema.parse({
    status: opts.status,
    source: opts.source,
  });

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(importJobs.systemId, systemId)];
    if (parsedQuery.status) conditions.push(eq(importJobs.status, parsedQuery.status));
    if (parsedQuery.source) conditions.push(eq(importJobs.source, parsedQuery.source));
    const decodedCursor = parseCursor(opts.cursor);
    if (decodedCursor) conditions.push(lt(importJobs.id, decodedCursor));

    const rows = await tx
      .select()
      .from(importJobs)
      .where(and(...conditions))
      .orderBy(desc(importJobs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toImportJobResult);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  id: ImportJobId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);
  const parseResult = UpdateImportJobBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body", {
      issues: parseResult.error.issues,
    });
  }
  const parsed = parseResult.data;

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // SELECT ... FOR UPDATE locks the row for the duration of the transaction
    // so two concurrent state-machine transitions cannot both pass the guard.
    // Without this, READ COMMITTED isolation would allow a double-resume:
    // both callers see `status = "failed"`, both check isResumableFromFailed,
    // both commit the same transition.
    const [current] = await tx
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    // State machine enforcement.
    //
    // Note: a same-state write (e.g., `failed → failed` to append an error
    // entry) is NOT blocked by this guard — the check only fires when the
    // status actually changes. That's intentional: workers may append new
    // error entries to an already-failed job without triggering the
    // resumability check, and progress bumps on `importing → importing`
    // are the normal hot path.
    if (parsed.status !== undefined && parsed.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status];
      if (!allowed.includes(parsed.status)) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "INVALID_STATE",
          `Illegal transition from ${current.status} to ${parsed.status}`,
        );
      }
      // failed → importing|validating: require last error to be fatal + recoverable
      if (current.status === "failed") {
        const currentErrorLog = parseErrorLog(current.errorLog);
        if (!isResumableFromFailed(currentErrorLog)) {
          throw new ApiHttpError(
            HTTP_CONFLICT,
            "INVALID_STATE",
            `Cannot resume ${current.status} → ${parsed.status}: last error is not recoverable`,
          );
        }
      }
    }

    const updates: Partial<typeof importJobs.$inferInsert> = { updatedAt: timestamp };
    const terminalTransition =
      parsed.status !== undefined &&
      TERMINAL_STATUSES.has(parsed.status) &&
      parsed.status !== current.status;
    const nonTerminalReentry =
      parsed.status !== undefined &&
      !TERMINAL_STATUSES.has(parsed.status) &&
      TERMINAL_STATUSES.has(current.status);

    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.progressPercent !== undefined) updates.progressPercent = parsed.progressPercent;
    if (parsed.warningCount !== undefined) updates.warningCount = parsed.warningCount;
    if (parsed.chunksTotal !== undefined) updates.chunksTotal = parsed.chunksTotal;
    if (parsed.chunksCompleted !== undefined) updates.chunksCompleted = parsed.chunksCompleted;
    if (parsed.errorLog !== undefined) {
      updates.errorLog = parsed.errorLog as readonly ImportError[] | null;
    }
    if (parsed.checkpointState !== undefined) {
      updates.checkpointState = parsed.checkpointState;
    }

    if (terminalTransition) {
      updates.completedAt = timestamp;
    } else if (nonTerminalReentry) {
      updates.completedAt = null;
    }

    const [row] = await tx
      .update(importJobs)
      .set(updates)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .returning();

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    const eventType = pickAuditEventType(current.status, row.status);
    await audit(tx, {
      eventType,
      actor: { kind: "account", id: auth.accountId },
      detail: `Import job ${id} (${current.status} → ${row.status})`,
      systemId,
    });

    return toImportJobResult(row);
  });
}
