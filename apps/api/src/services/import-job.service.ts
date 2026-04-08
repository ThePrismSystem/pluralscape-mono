import { importJobs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateImportJobBodySchema,
  ImportJobQuerySchema,
  UpdateImportJobBodySchema,
} from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  ImportCheckpointState,
  ImportError,
  ImportJobId,
  ImportJobStatus,
  ImportSource,
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
  readonly source: ImportSource;
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
  readonly source?: ImportSource;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toImportJobResult(row: typeof importJobs.$inferSelect): ImportJobResult {
  return {
    id: row.id as ImportJobId,
    accountId: row.accountId as AccountId,
    systemId: row.systemId as SystemId,
    source: row.source,
    status: row.status,
    progressPercent: row.progressPercent,
    errorLog: (row.errorLog as readonly ImportError[] | null) ?? null,
    warningCount: row.warningCount,
    chunksTotal: row.chunksTotal,
    chunksCompleted: row.chunksCompleted,
    checkpointState: row.checkpointState ?? null,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
  };
}

function parseBody<T>(
  schema: { safeParse(data: unknown): { success: true; data: T } | { success: false } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body");
  }
  return parsed.data;
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
  const parsed = parseBody(CreateImportJobBodySchema, params);

  const id = createId(ID_PREFIXES.importJob);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
    if (opts.cursor) conditions.push(lt(importJobs.id, opts.cursor));

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

const TERMINAL_STATUSES: ReadonlySet<ImportJobStatus> = new Set(["completed", "failed"]);

export async function updateImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  id: ImportJobId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);
  const parsed = parseBody(UpdateImportJobBodySchema, params);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updates: Partial<typeof importJobs.$inferInsert> = { updatedAt: timestamp };

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

    if (parsed.status && TERMINAL_STATUSES.has(parsed.status)) {
      updates.completedAt = timestamp;
    }

    const [row] = await tx
      .update(importJobs)
      .set(updates)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .returning();

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    await audit(tx, {
      eventType: "import-job.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Import job updated (status: ${row.status})`,
      systemId,
    });

    return toImportJobResult(row);
  });
}
