import { webhookDeliveries } from "@pluralscape/db/pg";
import { toUnixMillisOrNull } from "@pluralscape/types";
import { WebhookDeliveryQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  SystemId,
  WebhookDeliveryId,
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookId,
  PaginatedResult,
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
  readonly lastAttemptAt: number | null;
  readonly nextRetryAt: number | null;
  readonly createdAt: number;
}

export interface WebhookDeliveryListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly webhookId?: WebhookId;
  readonly status?: WebhookDeliveryStatus;
  readonly eventType?: WebhookEventType;
}

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
    id: row.id as WebhookDeliveryId,
    webhookId: row.webhookId as WebhookId,
    systemId: row.systemId as SystemId,
    eventType: row.eventType as WebhookEventType,
    status: row.status as WebhookDeliveryStatus,
    httpStatus: row.httpStatus,
    attemptCount: row.attemptCount,
    lastAttemptAt: toUnixMillisOrNull(row.lastAttemptAt),
    nextRetryAt: toUnixMillisOrNull(row.nextRetryAt),
    createdAt: row.createdAt,
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

  if (opts.cursor) {
    conditions.push(lt(webhookDeliveries.id, opts.cursor));
  }

  const rows = await db
    .select({
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
    })
    .from(webhookDeliveries)
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveries.id))
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toWebhookDeliveryResult);
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getWebhookDelivery(
  db: PostgresJsDatabase,
  systemId: SystemId,
  deliveryId: WebhookDeliveryId,
  auth: AuthContext,
): Promise<WebhookDeliveryResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select({
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
    })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.systemId, systemId)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook delivery not found");
  }

  return toWebhookDeliveryResult(row);
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteWebhookDelivery(
  db: PostgresJsDatabase,
  systemId: SystemId,
  deliveryId: WebhookDeliveryId,
  auth: AuthContext,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const deleted = await db
    .delete(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.systemId, systemId)))
    .returning({ id: webhookDeliveries.id });

  if (deleted.length === 0) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook delivery not found");
  }
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseWebhookDeliveryQuery(
  query: Record<string, string | undefined>,
): WebhookDeliveryListOptions {
  const result = WebhookDeliveryQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
