import { importEntityRefs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { ImportEntityRefQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  ImportEntityRefId,
  ImportEntityType,
  ImportSource,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface ImportEntityRefResult {
  readonly id: ImportEntityRefId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSource;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
  readonly importedAt: UnixMillis;
}

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

function toResult(row: typeof importEntityRefs.$inferSelect): ImportEntityRefResult {
  return {
    id: row.id as ImportEntityRefId,
    accountId: row.accountId as AccountId,
    systemId: row.systemId as SystemId,
    source: row.source,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
    pluralscapeEntityId: row.pluralscapeEntityId,
    importedAt: toUnixMillis(row.importedAt),
  };
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
    const existing = await tx
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

    if (existing.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        "Import entity ref already exists for this source",
      );
    }

    const [row] = await tx
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
      .returning();

    if (!row) {
      throw new Error("Failed to record import entity ref — INSERT returned no rows");
    }

    return toResult(row);
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
    if (opts.cursor) conditions.push(lt(importEntityRefs.id, opts.cursor));

    const rows = await tx
      .select()
      .from(importEntityRefs)
      .where(and(...conditions))
      .orderBy(desc(importEntityRefs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toResult);
  });
}
