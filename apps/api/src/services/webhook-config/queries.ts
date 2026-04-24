import { webhookConfigs } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { WebhookConfigQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { WEBHOOK_CONFIG_SELECT_COLUMNS, toWebhookConfigResult } from "./internal.js";

import type { WebhookConfigResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PaginatedResult, SystemId, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface WebhookConfigListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export async function listWebhookConfigs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: WebhookConfigListOptions = {},
): Promise<PaginatedResult<WebhookConfigResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(webhookConfigs.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(webhookConfigs.archived, false));
    }

    if (opts.cursor) {
      conditions.push(lt(webhookConfigs.id, brandId<WebhookId>(opts.cursor)));
    }

    const rows = await tx
      .select(WEBHOOK_CONFIG_SELECT_COLUMNS)
      .from(webhookConfigs)
      .where(and(...conditions))
      .orderBy(desc(webhookConfigs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toWebhookConfigResult);
  });
}

export async function getWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
): Promise<WebhookConfigResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select(WEBHOOK_CONFIG_SELECT_COLUMNS)
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.id, webhookId),
          eq(webhookConfigs.systemId, systemId),
          eq(webhookConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook config not found");
    }

    return toWebhookConfigResult(row);
  });
}

export function parseWebhookConfigQuery(
  query: Record<string, string | undefined>,
): WebhookConfigListOptions {
  return parseQuery(WebhookConfigQuerySchema, query);
}
