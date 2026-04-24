import { webhookDeliveries } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { WebhookDeliveryQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, gte, lt, lte } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { parseQuery } from "../lib/query-parse.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  PaginatedResult,
  SystemId,
  UnixMillis,
  WebhookDeliveryId,
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface WebhookDeliveryResult {
  readonly id: WebhookDeliveryId;
  readonly webhookId: WebhookId;
  readonly systemId: SystemId;
  readonly eventType: WebhookEventType;
  readonly status: WebhookDeliveryStatus;
  readonly httpStatus: number | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: UnixMillis | null;
  readonly nextRetryAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}

export interface WebhookDeliveryListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly webhookId?: WebhookId;
  readonly status?: WebhookDeliveryStatus;
  readonly eventType?: WebhookEventType;
  readonly fromDate?: number;
  readonly toDate?: number;
}

// ── Shared select columns ────────────────────────────────────────────

const WEBHOOK_DELIVERY_SELECT_COLUMNS = {
  id: webhookDeliveries.id,
  webhookId: webhookDeliveries.webhookId,
  systemId: webhookDeliveries.systemId,
  eventType: webhookDeliveries.eventType,
  status: webhookDeliveries.status,
  httpStatus: webhookDeliveries.httpStatus,
  attemptCount: webhookDeliveries.attemptCount,
  lastAttemptAt: webhookDeliveries.lastAttemptAt,
  nextRetryAt: webhookDeliveries.nextRetryAt,
  createdAt: webhookDeliveries.createdAt,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function toWebhookDeliveryResult(row: {
  id: string;
  webhookId: string;
  systemId: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  attemptCount: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  createdAt: number;
}): WebhookDeliveryResult {
  return {
    id: brandId<WebhookDeliveryId>(row.id),
    webhookId: brandId<WebhookId>(row.webhookId),
    systemId: brandId<SystemId>(row.systemId),
    eventType: row.eventType as WebhookEventType,
    status: row.status as WebhookDeliveryStatus,
    httpStatus: row.httpStatus,
    attemptCount: row.attemptCount,
    lastAttemptAt: toUnixMillisOrNull(row.lastAttemptAt),
    nextRetryAt: toUnixMillisOrNull(row.nextRetryAt),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listWebhookDeliveries(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: WebhookDeliveryListOptions = {},
): Promise<PaginatedResult<WebhookDeliveryResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(webhookDeliveries.systemId, systemId)];

    if (opts.webhookId) {
      conditions.push(eq(webhookDeliveries.webhookId, opts.webhookId));
    }

    if (opts.status) {
      conditions.push(eq(webhookDeliveries.status, opts.status));
    }

    if (opts.eventType) {
      conditions.push(eq(webhookDeliveries.eventType, opts.eventType));
    }

    if (opts.fromDate !== undefined) {
      conditions.push(gte(webhookDeliveries.createdAt, toUnixMillis(opts.fromDate)));
    }

    if (opts.toDate !== undefined) {
      conditions.push(lte(webhookDeliveries.createdAt, toUnixMillis(opts.toDate)));
    }

    if (opts.cursor) {
      conditions.push(lt(webhookDeliveries.id, brandId<WebhookDeliveryId>(opts.cursor)));
    }

    const rows = await tx
      .select(WEBHOOK_DELIVERY_SELECT_COLUMNS)
      .from(webhookDeliveries)
      .where(and(...conditions))
      .orderBy(desc(webhookDeliveries.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toWebhookDeliveryResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getWebhookDelivery(
  db: PostgresJsDatabase,
  systemId: SystemId,
  deliveryId: WebhookDeliveryId,
  auth: AuthContext,
): Promise<WebhookDeliveryResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select(WEBHOOK_DELIVERY_SELECT_COLUMNS)
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook delivery not found");
    }

    return toWebhookDeliveryResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteWebhookDelivery(
  db: PostgresJsDatabase,
  systemId: SystemId,
  deliveryId: WebhookDeliveryId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.systemId, systemId)))
      .returning({ id: webhookDeliveries.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook delivery not found");
    }

    await audit(tx, {
      eventType: "webhook-delivery.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Webhook delivery deleted",
      systemId,
    });
  });
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseWebhookDeliveryQuery(
  query: Record<string, string | undefined>,
): WebhookDeliveryListOptions {
  return parseQuery(WebhookDeliveryQuerySchema, query);
}
