import { importEntityRefs } from "@pluralscape/db/pg";
import {
  assertBrandedTargetId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
} from "@pluralscape/types";
import { ImportEntityRefQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

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
  ImportEntityType,
  ImportSourceFormat,
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
  readonly source: ImportSourceFormat;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

export interface LookupImportEntityRefInput {
  readonly source: ImportSourceFormat;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
}

export interface LookupImportEntityRefBatchInput {
  readonly source: ImportSource;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityIds: readonly string[];
}

export interface UpsertImportEntityRefBatchEntry {
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

export interface UpsertImportEntityRefBatchInput {
  readonly source: ImportSource;
  readonly entries: readonly UpsertImportEntityRefBatchEntry[];
}

export interface UpsertImportEntityRefBatchResult {
  readonly upserted: number;
  readonly unchanged: number;
}

interface ListImportEntityRefsOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly source?: ImportSourceFormat;
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

  // `assertBrandedTargetId` is the single runtime narrowing boundary between
  // raw DB varchars and branded target IDs; all consumers get type-safe
  // narrowing via the sourceEntityType discriminator.
  switch (sourceEntityType) {
    case "member":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("member", rawTargetId),
      };
    case "group":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("group", rawTargetId),
      };
    case "fronting-session":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("fronting-session", rawTargetId),
      };
    case "switch":
      return { ...base, sourceEntityType, pluralscapeEntityId: rawTargetId };
    case "custom-field":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("custom-field", rawTargetId),
      };
    case "note":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("note", rawTargetId),
      };
    case "chat-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("chat-message", rawTargetId),
      };
    case "board-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("board-message", rawTargetId),
      };
    case "poll":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("poll", rawTargetId),
      };
    case "timer":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("timer", rawTargetId),
      };
    case "privacy-bucket":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("privacy-bucket", rawTargetId),
      };
    case "custom-front":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("custom-front", rawTargetId),
      };
    case "fronting-comment":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("fronting-comment", rawTargetId),
      };
    case "field-definition":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("field-definition", rawTargetId),
      };
    case "field-value":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("field-value", rawTargetId),
      };
    case "journal-entry":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("journal-entry", rawTargetId),
      };
    case "channel-category":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("channel-category", rawTargetId),
      };
    case "channel":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("channel", rawTargetId),
      };
    case "system-profile":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("system-profile", rawTargetId),
      };
    case "system-settings":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("system-settings", rawTargetId),
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

// ── LOOKUP BATCH ────────────────────────────────────────────────────

/**
 * Look up many import entity refs in a single round-trip.
 *
 * Returns a map of `sourceEntityId → pluralscapeEntityId` for matching rows.
 * Missing source IDs are absent from the map (not present with `null` value),
 * so callers can use `Map.has()` to detect already-imported entities.
 *
 * The unique constraint
 * `(account_id, system_id, source, source_entity_type, source_entity_id)`
 * guarantees at most one match per `sourceEntityId`.
 */
export async function lookupImportEntityRefBatch(
  db: PostgresJsDatabase,
  systemId: SystemId,
  input: LookupImportEntityRefBatchInput,
  auth: AuthContext,
): Promise<ReadonlyMap<string, string>> {
  assertSystemOwnership(systemId, auth);

  if (input.sourceEntityIds.length === 0) {
    return new Map();
  }

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select({
        sourceEntityId: importEntityRefs.sourceEntityId,
        pluralscapeEntityId: importEntityRefs.pluralscapeEntityId,
      })
      .from(importEntityRefs)
      .where(
        and(
          eq(importEntityRefs.systemId, systemId),
          eq(importEntityRefs.source, input.source),
          eq(importEntityRefs.sourceEntityType, input.sourceEntityType),
          inArray(importEntityRefs.sourceEntityId, [...input.sourceEntityIds]),
        ),
      );

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.sourceEntityId, row.pluralscapeEntityId);
    }
    return map;
  });
}

// ── UPSERT BATCH ────────────────────────────────────────────────────

/**
 * Insert or update many import entity refs in a single round-trip.
 *
 * Idempotent: re-running with the same payload updates `pluralscape_entity_id`
 * and `imported_at` on conflict via the unique index
 * `(account_id, system_id, source, source_entity_type, source_entity_id)`.
 *
 * Returns counts of how many rows were upserted vs unchanged. A row counts as
 * "unchanged" when the existing `pluralscape_entity_id` already matched the
 * incoming value (the SQL `EXCLUDED` write is a no-op write but still returns
 * the row, so we check before/after equality).
 */
export async function upsertImportEntityRefBatch(
  db: PostgresJsDatabase,
  systemId: SystemId,
  input: UpsertImportEntityRefBatchInput,
  auth: AuthContext,
): Promise<UpsertImportEntityRefBatchResult> {
  assertSystemOwnership(systemId, auth);

  if (input.entries.length === 0) {
    return { upserted: 0, unchanged: 0 };
  }

  for (const entry of input.entries) {
    if (entry.sourceEntityId.length === 0 || entry.pluralscapeEntityId.length === 0) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid entity ref entry");
    }
  }

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Snapshot existing rows so we can compute the unchanged count after the
    // upsert. Drizzle's onConflictDoUpdate doesn't expose a returning of
    // pre-conflict state directly.
    const sourceEntityIds = input.entries.map((e) => e.sourceEntityId);
    const existing = await tx
      .select({
        sourceEntityType: importEntityRefs.sourceEntityType,
        sourceEntityId: importEntityRefs.sourceEntityId,
        pluralscapeEntityId: importEntityRefs.pluralscapeEntityId,
      })
      .from(importEntityRefs)
      .where(
        and(
          eq(importEntityRefs.systemId, systemId),
          eq(importEntityRefs.source, input.source),
          inArray(importEntityRefs.sourceEntityId, sourceEntityIds),
        ),
      );

    const existingByKey = new Map<string, string>();
    for (const row of existing) {
      existingByKey.set(`${row.sourceEntityType}|${row.sourceEntityId}`, row.pluralscapeEntityId);
    }

    const values = input.entries.map((entry) => ({
      id: createId(ID_PREFIXES.importEntityRef),
      accountId: auth.accountId,
      systemId,
      source: input.source,
      sourceEntityType: entry.sourceEntityType,
      sourceEntityId: entry.sourceEntityId,
      pluralscapeEntityId: entry.pluralscapeEntityId,
      importedAt: timestamp,
    }));

    await tx
      .insert(importEntityRefs)
      .values(values)
      .onConflictDoUpdate({
        target: [
          importEntityRefs.accountId,
          importEntityRefs.systemId,
          importEntityRefs.source,
          importEntityRefs.sourceEntityType,
          importEntityRefs.sourceEntityId,
        ],
        set: {
          pluralscapeEntityId: sql`excluded.pluralscape_entity_id`,
          importedAt: sql`excluded.imported_at`,
        },
      });

    let unchanged = 0;
    for (const entry of input.entries) {
      const prior = existingByKey.get(`${entry.sourceEntityType}|${entry.sourceEntityId}`);
      if (prior === entry.pluralscapeEntityId) {
        unchanged += 1;
      }
    }

    return {
      upserted: input.entries.length - unchanged,
      unchanged,
    };
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
