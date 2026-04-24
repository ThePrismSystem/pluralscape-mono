import { importJobs } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { ImportJobQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { buildPaginatedResult, parseCursor } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";

import { toImportJobResult } from "./internal.js";

import type { ImportJobResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  ImportJobId,
  ImportJobStatus,
  ImportSourceFormat,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListImportJobOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: ImportJobStatus;
  readonly source?: ImportSourceFormat;
}

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
    const decodedCursor = parseCursor(opts.cursor);
    if (decodedCursor) conditions.push(lt(importJobs.id, brandId<ImportJobId>(decodedCursor)));

    const rows = await tx
      .select()
      .from(importJobs)
      .where(and(...conditions))
      .orderBy(desc(importJobs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toImportJobResult);
  });
}
