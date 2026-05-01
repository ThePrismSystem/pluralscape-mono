import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  HierarchyCreateBody,
  HierarchyServiceConfig,
  HierarchyUpdateBody,
} from "../hierarchy-service-types.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateEntity<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  body: TUpdateBody,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TResult> {
  const { table, columns, entityName, toResult, events } = cfg;

  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    if (cfg.beforeUpdate) {
      await cfg.beforeUpdate(tx, entityId, body, systemId);
    }

    const extraValues = cfg.updateSetValues(body);

    const updated = await tx
      .update(table)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
        ...extraValues,
      } as Record<string, unknown>)
      .where(
        and(
          eq(columns.id, entityId),
          eq(columns.systemId, systemId),
          eq(columns.version, body.version),
          eq(columns.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: columns.id })
          .from(table)
          .where(
            and(
              eq(columns.id, entityId),
              eq(columns.systemId, systemId),
              eq(columns.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      entityName,
    );

    await audit(tx, {
      eventType: events.updated,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} updated`,
      systemId,
    });
    if (cfg.webhookEvents) {
      await dispatchWebhookEvent(
        tx,
        systemId,
        cfg.webhookEvents.updated,
        cfg.webhookEvents.buildPayload(entityId),
      );
    }

    return toResult(row as TRow);
  });
}
