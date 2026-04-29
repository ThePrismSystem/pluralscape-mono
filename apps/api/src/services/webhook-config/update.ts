import { randomBytes } from "node:crypto";

import { webhookConfigs } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import {
  RotateWebhookSecretBodySchema,
  UpdateWebhookConfigBodySchema,
} from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { WEBHOOK_SECRET_BYTES } from "../../service.constants.js";
import { invalidateWebhookConfigCache } from "../webhook-dispatcher.js";

import {
  WEBHOOK_CONFIG_SELECT_COLUMNS,
  toServerSecret,
  toWebhookConfigResult,
  validateWebhookUrl,
} from "./internal.js";

import type { WebhookConfigCreateResult, WebhookConfigResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(webhookConfigs)
      .set({
        updatedAt: timestamp,
        version: sql`${webhookConfigs.version} + 1`,
        ...(url !== undefined && { url }),
        ...(eventTypes !== undefined && { eventTypes }),
        ...(enabled !== undefined && { enabled }),
      })
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

  invalidateWebhookConfigCache(systemId);
  return result;
}

export async function rotateWebhookSecret(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<WebhookConfigCreateResult> {
  assertSystemOwnership(systemId, auth);

  const parseResult = RotateWebhookSecretBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { version } = parseResult.data;
  const timestamp = now();
  const secretBytes = toServerSecret(randomBytes(WEBHOOK_SECRET_BYTES));

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(webhookConfigs)
      .set({
        secret: secretBytes,
        updatedAt: timestamp,
        version: sql`${webhookConfigs.version} + 1`,
      })
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
      eventType: "webhook-config.secret-rotated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Webhook config secret rotated",
      systemId,
    });

    return {
      ...toWebhookConfigResult(row),
      secret: Buffer.from(secretBytes).toString("base64"),
      secretBytes,
    };
  });

  invalidateWebhookConfigCache(systemId);
  return result;
}
