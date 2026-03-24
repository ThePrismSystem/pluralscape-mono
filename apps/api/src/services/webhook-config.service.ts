import { randomBytes } from "node:crypto";

import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateWebhookConfigBodySchema,
  UpdateWebhookConfigBodySchema,
  WebhookConfigQuerySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { resolveAndValidateUrl } from "../lib/ip-validation.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, WEBHOOK_SECRET_BYTES } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { PaginatedResult, SystemId, WebhookEventType, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface WebhookConfigResult {
  readonly id: WebhookId;
  readonly systemId: SystemId;
  readonly url: string;
  readonly eventTypes: readonly WebhookEventType[];
  readonly enabled: boolean;
  readonly cryptoKeyId: string | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Returned from create only — includes the raw secret for the caller to store. */
export interface WebhookConfigCreateResult extends WebhookConfigResult {
  readonly secret: string;
}

export interface WebhookConfigListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

// ── Shared select columns ────────────────────────────────────────────

const WEBHOOK_CONFIG_SELECT_COLUMNS = {
  id: webhookConfigs.id,
  systemId: webhookConfigs.systemId,
  url: webhookConfigs.url,
  eventTypes: webhookConfigs.eventTypes,
  enabled: webhookConfigs.enabled,
  cryptoKeyId: webhookConfigs.cryptoKeyId,
  version: webhookConfigs.version,
  archived: webhookConfigs.archived,
  archivedAt: webhookConfigs.archivedAt,
  createdAt: webhookConfigs.createdAt,
  updatedAt: webhookConfigs.updatedAt,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function toWebhookConfigResult(row: {
  id: string;
  systemId: string;
  url: string;
  eventTypes: readonly WebhookEventType[];
  enabled: boolean;
  cryptoKeyId: string | null;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): WebhookConfigResult {
  return {
    id: row.id as WebhookId,
    systemId: row.systemId as SystemId,
    url: row.url,
    eventTypes: row.eventTypes,
    enabled: row.enabled,
    cryptoKeyId: row.cryptoKeyId,
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/**
 * Validate a webhook URL for protocol and SSRF safety.
 *
 * - Enforces HTTPS in production.
 * - Resolves the hostname and checks all resolved IPs against private/reserved ranges.
 */
async function validateWebhookUrl(url: string): Promise<void> {
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Webhook URL must use HTTPS in production",
    );
  }

  try {
    await resolveAndValidateUrl(url);
  } catch (error: unknown) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Webhook URL validation failed",
    );
  }
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<WebhookConfigCreateResult> {
  assertSystemOwnership(systemId, auth);

  const result = CreateWebhookConfigBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { url, eventTypes, enabled, cryptoKeyId } = result.data;
  await validateWebhookUrl(url);

  const whId = createId(ID_PREFIXES.webhook);
  const timestamp = now();
  const secretBytes = randomBytes(WEBHOOK_SECRET_BYTES);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [row] = await tx
      .insert(webhookConfigs)
      .values({
        id: whId,
        systemId,
        url,
        secret: secretBytes,
        eventTypes,
        enabled,
        cryptoKeyId: cryptoKeyId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create webhook config — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "webhook-config.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Webhook config created",
      systemId,
    });

    return {
      ...toWebhookConfigResult(row),
      secret: secretBytes.toString("base64"),
    };
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listWebhookConfigs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: WebhookConfigListOptions = {},
): Promise<PaginatedResult<WebhookConfigResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const conditions = [eq(webhookConfigs.systemId, systemId)];

  if (!opts.includeArchived) {
    conditions.push(eq(webhookConfigs.archived, false));
  }

  if (opts.cursor) {
    conditions.push(lt(webhookConfigs.id, opts.cursor));
  }

  const rows = await db
    .select(WEBHOOK_CONFIG_SELECT_COLUMNS)
    .from(webhookConfigs)
    .where(and(...conditions))
    .orderBy(desc(webhookConfigs.id))
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toWebhookConfigResult);
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
): Promise<WebhookConfigResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
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
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<WebhookConfigResult> {
  assertSystemOwnership(systemId, auth);

  const parseResult = UpdateWebhookConfigBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { url, eventTypes, enabled, version } = parseResult.data;

  if (url !== undefined) {
    await validateWebhookUrl(url);
  }

  const timestamp = now();

  const setFields: Record<string, unknown> = {
    updatedAt: timestamp,
    version: sql`${webhookConfigs.version} + 1`,
  };

  if (url !== undefined) {
    setFields.url = url;
  }
  if (eventTypes !== undefined) {
    setFields.eventTypes = eventTypes;
  }
  if (enabled !== undefined) {
    setFields.enabled = enabled;
  }

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const updated = await tx
      .update(webhookConfigs)
      .set(setFields)
      .where(
        and(
          eq(webhookConfigs.id, webhookId),
          eq(webhookConfigs.systemId, systemId),
          eq(webhookConfigs.version, version),
          eq(webhookConfigs.archived, false),
        ),
      )
      .returning(WEBHOOK_CONFIG_SELECT_COLUMNS);

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: webhookConfigs.id })
          .from(webhookConfigs)
          .where(
            and(
              eq(webhookConfigs.id, webhookId),
              eq(webhookConfigs.systemId, systemId),
              eq(webhookConfigs.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Webhook config",
    );

    await audit(tx, {
      eventType: "webhook-config.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Webhook config updated",
      systemId,
    });

    return toWebhookConfigResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [existing] = await tx
      .select({ id: webhookConfigs.id })
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.id, webhookId),
          eq(webhookConfigs.systemId, systemId),
          eq(webhookConfigs.archived, false),
        ),
      )
      .for("update")
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook config not found");
    }

    // Check for pending deliveries
    const [pendingCount] = await tx
      .select({ count: count() })
      .from(webhookDeliveries)
      .where(
        and(eq(webhookDeliveries.webhookId, webhookId), eq(webhookDeliveries.status, "pending")),
      );

    if (!pendingCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (pendingCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Webhook config has ${String(pendingCount.count)} pending delivery(ies). Wait for deliveries to complete or delete them first.`,
      );
    }

    await audit(tx, {
      eventType: "webhook-config.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Webhook config deleted",
      systemId,
    });

    await tx
      .delete(webhookConfigs)
      .where(and(eq(webhookConfigs.id, webhookId), eq(webhookConfigs.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const WEBHOOK_CONFIG_LIFECYCLE = {
  table: webhookConfigs,
  columns: webhookConfigs,
  entityName: "Webhook config",
  archiveEvent: "webhook-config.archived" as const,
  restoreEvent: "webhook-config.restored" as const,
};

export async function archiveWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, webhookId, auth, audit, WEBHOOK_CONFIG_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<WebhookConfigResult> {
  return restoreEntity(db, systemId, webhookId, auth, audit, WEBHOOK_CONFIG_LIFECYCLE, (row) => {
    const r = row as typeof webhookConfigs.$inferSelect;
    return toWebhookConfigResult(r);
  });
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseWebhookConfigQuery(
  query: Record<string, string | undefined>,
): WebhookConfigListOptions {
  const result = WebhookConfigQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
