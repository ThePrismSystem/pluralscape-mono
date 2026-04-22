import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_WEBHOOK_CONFIGS_PER_SYSTEM } from "../../quota.constants.js";
import { invalidateWebhookConfigCache } from "../webhook-dispatcher.js";

import { toWebhookConfigResult } from "./internal.js";

import type { WebhookConfigResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { SystemId, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
    const { dependents } = await checkDependents(tx, [
      {
        table: webhookDeliveries,
        predicate: and(
          eq(webhookDeliveries.webhookId, webhookId),
          eq(webhookDeliveries.status, "pending"),
        ),
        typeName: "pendingDeliveries",
      },
    ]);

    const pendingDep = dependents.find((d) => d.type === "pendingDeliveries");
    if (pendingDep) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Webhook config has ${String(pendingDep.count)} pending delivery(ies). Wait for deliveries to complete or delete them first.`,
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

  invalidateWebhookConfigCache(systemId);
}

const WEBHOOK_CONFIG_LIFECYCLE: ArchivableEntityConfig<WebhookId> = {
  table: webhookConfigs,
  columns: webhookConfigs,
  entityName: "Webhook config",
  archiveEvent: "webhook-config.archived" as const,
  restoreEvent: "webhook-config.restored" as const,
  onRestore: async (tx, systemId) => {
    // restoreEntity sets archived=false BEFORE calling onRestore, so the
    // just-restored config is already counted as non-archived. Use strict >
    // because the restored config is already included in the count.
    const [existing] = await tx
      .select({ count: count() })
      .from(webhookConfigs)
      .where(and(eq(webhookConfigs.systemId, systemId), eq(webhookConfigs.archived, false)));

    if ((existing?.count ?? 0) > MAX_WEBHOOK_CONFIGS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_WEBHOOK_CONFIGS_PER_SYSTEM)} webhook configs per system`,
      );
    }
  },
};

export async function archiveWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, webhookId, auth, audit, WEBHOOK_CONFIG_LIFECYCLE);
  invalidateWebhookConfigCache(systemId);
}

export async function restoreWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<WebhookConfigResult> {
  const result = await restoreEntity(
    db,
    systemId,
    webhookId,
    auth,
    audit,
    WEBHOOK_CONFIG_LIFECYCLE,
    (row) => toWebhookConfigResult(row as typeof webhookConfigs.$inferSelect),
  );
  invalidateWebhookConfigCache(systemId);
  return result;
}
