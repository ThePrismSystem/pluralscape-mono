import { importEntityRefs } from "@pluralscape/db/pg";
import { and, eq, inArray } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toResult } from "./internal.js";

import type { ImportEntityRefResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ImportEntityType, ImportSourceFormat, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface LookupImportEntityRefInput {
  readonly source: ImportSourceFormat;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
}

export interface LookupImportEntityRefBatchInput {
  readonly source: ImportSourceFormat;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityIds: readonly string[];
}

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
