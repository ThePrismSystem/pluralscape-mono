import { randomBytes } from "node:crypto";

import { systems, webhookConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateWebhookConfigBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_WEBHOOK_CONFIGS_PER_SYSTEM } from "../../quota.constants.js";
import { WEBHOOK_SECRET_BYTES } from "../../service.constants.js";
import { invalidateWebhookConfigCache } from "../webhook-dispatcher.js";

import { toServerSecret, toWebhookConfigResult, validateWebhookUrl } from "./internal.js";

import type { WebhookConfigCreateResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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

  const created = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock the system row to serialize concurrent webhook config creation per system (prevents TOCTOU race)
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(webhookConfigs)
      .where(and(eq(webhookConfigs.systemId, systemId), eq(webhookConfigs.archived, false)));

    if ((existing?.count ?? 0) >= MAX_WEBHOOK_CONFIGS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_WEBHOOK_CONFIGS_PER_SYSTEM)} webhook configs per system`,
      );
    }

    const secretBytes = toServerSecret(randomBytes(WEBHOOK_SECRET_BYTES));

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
      secret: Buffer.from(secretBytes).toString("base64"),
      secretBytes,
    };
  });

  invalidateWebhookConfigCache(systemId);
  return created;
}
