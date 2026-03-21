import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";

import type { BaseHierarchyResult, DependentCheck } from "./hierarchy-service-types.js";
import type { EncryptedBlob, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Base field mapper ────────────────────────────────────────────

/** Maps base columns shared by all hierarchy entities. */
export function mapBaseFields(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): BaseHierarchyResult {
  return {
    id: row.id,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

// ── Dependent check ──────────────────────────────────────────────

/** Check dependent tables for active references before delete. Throws 409 if dependents exist. */
export async function checkDependents(
  tx: PostgresJsDatabase,
  entityId: string,
  systemId: SystemId,
  entityName: string,
  dependentChecks: readonly DependentCheck[],
): Promise<void> {
  if (dependentChecks.length === 0) return;

  const results = await Promise.all(
    dependentChecks.map((dep) => {
      const conditions = [eq(dep.entityColumn, entityId), eq(dep.systemColumn, systemId)];

      if (dep.filterArchived) {
        conditions.push(eq(dep.filterArchived, false));
      }

      return tx
        .select({ count: count() })
        .from(dep.table)
        .where(and(...conditions));
    }),
  );

  const counts: { label: string; count: number }[] = [];
  results.forEach((rows, i) => {
    // Type-narrowing guard: always defined since results comes from mapping dependentChecks
    const dep = dependentChecks[i];
    if (!dep) {
      throw new Error("Unexpected: results/dependentChecks length mismatch");
    }
    // Type-narrowing guard: count() always returns a row
    const [result] = rows;
    if (!result) {
      throw new Error("Unexpected: count query returned no rows");
    }
    if (result.count > 0) {
      counts.push({ label: dep.label, count: result.count });
    }
  });

  if (counts.length > 0) {
    const parts = counts.map((c) => `${String(c.count)} ${c.label}`);
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "HAS_DEPENDENTS",
      `${entityName} has ${parts.join(" and ")}. Remove all dependents before deleting.`,
    );
  }
}
