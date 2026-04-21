import { importEntityRefs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_INTERNAL_SERVER_ERROR,
} from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toResult } from "./internal.js";

import type { ImportEntityRefResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ImportEntityType, ImportSourceFormat, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface RecordImportEntityRefInput {
  readonly source: ImportSourceFormat;
  readonly sourceEntityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

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
