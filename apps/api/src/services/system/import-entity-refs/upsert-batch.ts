import { importEntityRefs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ImportEntityType, ImportSourceFormat, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface UpsertImportEntityRefBatchEntry {
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

export interface UpsertImportEntityRefBatchInput {
  readonly source: ImportSourceFormat;
  readonly entries: readonly UpsertImportEntityRefBatchEntry[];
}

export interface UpsertImportEntityRefBatchResult {
  readonly upserted: number;
  readonly unchanged: number;
}

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
    const distinctEntityTypes = [...new Set(input.entries.map((e) => e.sourceEntityType))];
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
          inArray(importEntityRefs.sourceEntityType, distinctEntityTypes),
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
