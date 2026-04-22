import { importJobs } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toImportJobResult } from "./internal.js";

import type { ImportJobResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { ImportJobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
