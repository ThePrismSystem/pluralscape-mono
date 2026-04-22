import { apiKeys } from "@pluralscape/db/pg";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { API_KEY_SELECT_COLUMNS, toApiKeyResult, type ApiKeyResult } from "./internal.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiKeyId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ──────────────────────────────────────────────────────────

export interface ApiKeyListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  /** When true, include revoked keys in the listing. */
  readonly includeRevoked?: boolean;
}

// ── LIST ───────────────────────────────────────────────────────────

export async function listApiKeys(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ApiKeyListOptions = {},
): Promise<PaginatedResult<ApiKeyResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(apiKeys.systemId, systemId)];

    if (!opts.includeRevoked) {
      conditions.push(isNull(apiKeys.revokedAt));
    }

    if (opts.cursor) {
      conditions.push(lt(apiKeys.id, opts.cursor));
    }

    const rows = await tx
      .select(API_KEY_SELECT_COLUMNS)
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toApiKeyResult);
  });
}

// ── GET ────────────────────────────────────────────────────────────

export async function getApiKey(
  db: PostgresJsDatabase,
  systemId: SystemId,
  apiKeyId: ApiKeyId,
  auth: AuthContext,
): Promise<ApiKeyResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select(API_KEY_SELECT_COLUMNS)
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "API key not found");
    }

    return toApiKeyResult(row);
  });
}
