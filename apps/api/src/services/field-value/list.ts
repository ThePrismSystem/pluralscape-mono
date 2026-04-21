import { fieldValues } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import {
  assertOwnerActiveAndGetColumns,
  ownerWhereColumn,
  toFieldValueResult,
} from "./internal.js";

import type { FieldValueOwner, FieldValueResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listFieldValuesForOwner(
  db: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
  auth: AuthContext,
): Promise<FieldValueResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertOwnerActiveAndGetColumns(tx, systemId, owner);

    const rows = await tx
      .select()
      .from(fieldValues)
      .where(and(ownerWhereColumn(owner), eq(fieldValues.systemId, systemId)));

    return rows.map(toFieldValueResult);
  });
}
