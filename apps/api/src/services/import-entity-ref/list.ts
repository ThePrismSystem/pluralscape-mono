import { importEntityRefs } from "@pluralscape/db/pg";
import { ImportEntityRefQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { buildPaginatedResult, parseCursor } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toResult } from "./internal.js";

import type { ImportEntityRefResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  ImportEntityType,
  ImportSourceFormat,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListImportEntityRefsOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly source?: ImportSourceFormat;
  readonly entityType?: ImportEntityType;
  readonly sourceEntityId?: string;
}

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
