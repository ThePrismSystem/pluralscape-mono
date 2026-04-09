import { importEntityRefs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { ImportEntityRefQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_INTERNAL_SERVER_ERROR } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult, parseCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  ImportEntityRef,
  ImportEntityRefId,
  ImportEntityTargetIdMap,
  ImportEntityType,
  ImportSource,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

/**
 * Canonical service result type — delegates to the discriminated union
 * in @pluralscape/types. Consumers narrow via sourceEntityType to get
 * the correct branded target ID without manual casting.
 */
export type ImportEntityRefResult = ImportEntityRef;

export interface RecordImportEntityRefInput {
  readonly source: ImportSource;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

export interface LookupImportEntityRefInput {
  readonly source: ImportSource;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
}

interface ListImportEntityRefsOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly source?: ImportSource;
  readonly entityType?: ImportEntityType;
  readonly sourceEntityId?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toResult(row: typeof importEntityRefs.$inferSelect): ImportEntityRef {
  const base = {
    id: row.id as ImportEntityRefId,
    accountId: row.accountId as AccountId,
    systemId: row.systemId as SystemId,
    source: row.source,
    sourceEntityId: row.sourceEntityId,
    importedAt: toUnixMillis(row.importedAt),
  };
  const sourceEntityType = row.sourceEntityType;
  const rawTargetId = row.pluralscapeEntityId;

  // One cast per variant. This is the single place in the codebase where
  // the raw DB varchar is narrowed to a branded ID; all consumers get
  // type-safe narrowing via the sourceEntityType discriminator.
  switch (sourceEntityType) {
    case "member":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["member"],
      };
    case "group":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["group"],
      };
    case "fronting-session":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["fronting-session"],
      };
    case "switch":
      return { ...base, sourceEntityType, pluralscapeEntityId: rawTargetId };
    case "custom-field":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["custom-field"],
      };
    case "note":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["note"],
      };
    case "chat-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["chat-message"],
      };
    case "board-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["board-message"],
      };
    case "poll":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["poll"],
      };
    case "timer":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["timer"],
      };
    case "privacy-bucket":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["privacy-bucket"],
      };
    case "friend":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: rawTargetId as ImportEntityTargetIdMap["friend"],
      };
    case "unknown":
      return { ...base, sourceEntityType, pluralscapeEntityId: rawTargetId };
    default: {
      const _exhaustive: never = sourceEntityType;
      throw new Error(`Unhandled import entity type: ${String(_exhaustive)}`);
    }
  }
}

// ── RECORD ──────────────────────────────────────────────────────────

export async function recordImportEntityRef(
  db: PostgresJsDatabase,
  systemId: SystemId,
  input: RecordImportEntityRefInput,
  auth: AuthContext,
): Promise<ImportEntityRefResult> {
  assertSystemOwnership(systemId, auth);

  if (input.sourceEntityId.length === 0 || input.pluralscapeEntityId.length === 0) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid entity ref");
  }

  const id = createId(ID_PREFIXES.importEntityRef);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const inserted = await tx
      .insert(importEntityRefs)
      .values({
        id,
        accountId: auth.accountId,
        systemId,
        source: input.source,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        pluralscapeEntityId: input.pluralscapeEntityId,
        importedAt: timestamp,
      })
      .onConflictDoNothing({
        target: [
          importEntityRefs.accountId,
          importEntityRefs.systemId,
          importEntityRefs.source,
          importEntityRefs.sourceEntityType,
          importEntityRefs.sourceEntityId,
        ],
      })
      .returning();

    if (inserted.length > 0) {
      const row = inserted[0];
      if (!row) {
        throw new ApiHttpError(
          HTTP_INTERNAL_SERVER_ERROR,
          "INTERNAL_ERROR",
          "INSERT returned empty row",
          { reason: "insert_returned_empty" },
        );
      }
      return toResult(row);
    }

    // Conflict path: fetch the existing row and check for divergence.
    const [existing] = await tx
      .select()
      .from(importEntityRefs)
      .where(
        and(
          eq(importEntityRefs.accountId, auth.accountId),
          eq(importEntityRefs.systemId, systemId),
          eq(importEntityRefs.source, input.source),
          eq(importEntityRefs.sourceEntityType, input.sourceEntityType),
          eq(importEntityRefs.sourceEntityId, input.sourceEntityId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(
        HTTP_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Race detected — insert skipped but no row found",
        { reason: "race_detected" },
      );
    }

    if (existing.pluralscapeEntityId !== input.pluralscapeEntityId) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        "Source entity is already mapped to a different target",
        { reason: "source_already_mapped" },
      );
    }

    return toResult(existing);
  });
}

// ── LOOKUP ──────────────────────────────────────────────────────────

export async function lookupImportEntityRef(
  db: PostgresJsDatabase,
  systemId: SystemId,
  input: LookupImportEntityRefInput,
  auth: AuthContext,
): Promise<ImportEntityRefResult | null> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(importEntityRefs)
      .where(
        and(
          eq(importEntityRefs.systemId, systemId),
          eq(importEntityRefs.source, input.source),
          eq(importEntityRefs.sourceEntityType, input.sourceEntityType),
          eq(importEntityRefs.sourceEntityId, input.sourceEntityId),
        ),
      )
      .limit(1);

    return row ? toResult(row) : null;
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listImportEntityRefs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListImportEntityRefsOpts,
): Promise<PaginatedResult<ImportEntityRefResult>> {
  assertSystemOwnership(systemId, auth);
  const parsedQuery = ImportEntityRefQuerySchema.parse({
    source: opts.source,
    entityType: opts.entityType,
    sourceEntityId: opts.sourceEntityId,
  });

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(importEntityRefs.systemId, systemId)];
    if (parsedQuery.source) conditions.push(eq(importEntityRefs.source, parsedQuery.source));
    if (parsedQuery.entityType) {
      conditions.push(eq(importEntityRefs.sourceEntityType, parsedQuery.entityType));
    }
    if (parsedQuery.sourceEntityId) {
      conditions.push(eq(importEntityRefs.sourceEntityId, parsedQuery.sourceEntityId));
    }
    const decodedCursor = parseCursor(opts.cursor);
    if (decodedCursor) conditions.push(lt(importEntityRefs.id, decodedCursor));

    const rows = await tx
      .select()
      .from(importEntityRefs)
      .where(and(...conditions))
      .orderBy(desc(importEntityRefs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toResult);
  });
}
