import { systems } from "@pluralscape/db/pg";
import { createId, now } from "@pluralscape/types";
import { and, count, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
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

export async function createEntity<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: TCreateBody,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TResult> {
  const { table, columns, idPrefix, entityName, parentFieldName, toResult, events } = cfg;

  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const entityId = createId(idPrefix);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system quota if configured
    if (cfg.maxPerSystem !== undefined) {
      await tx
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.id, systemId))
        .for("update");

      const [existing] = await tx
        .select({ count: count() })
        .from(table)
        .where(and(eq(columns.systemId, systemId), eq(columns.archived, false)));

      if ((existing?.count ?? 0) >= cfg.maxPerSystem) {
        throw new ApiHttpError(
          HTTP_TOO_MANY_REQUESTS,
          "QUOTA_EXCEEDED",
          `Maximum of ${String(cfg.maxPerSystem)} ${entityName.toLowerCase()}s per system`,
        );
      }
    }

    // Validate parent exists in same system if non-null. The body is typed
    // generically — the parent field is referenced by name from cfg.parentFieldName,
    // so we read the value via Reflect.get which keeps strict typing without
    // any cast.
    const rawParentId: unknown = Reflect.get(body, parentFieldName);
    const parentId = typeof rawParentId === "string" ? rawParentId : null;
    if (parentId !== null) {
      const [parent] = await tx
        .select({ id: columns.id })
        .from(table)
        .where(
          and(
            eq(columns.id, parentId),
            eq(columns.systemId, systemId),
            eq(columns.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(
          HTTP_NOT_FOUND,
          "NOT_FOUND",
          `Parent ${entityName.toLowerCase()} not found`,
        );
      }
    }

    const extraValues = cfg.createInsertValues(body);

    const [row] = await tx
      .insert(table)
      .values({
        id: entityId,
        systemId,
        [parentFieldName]: parentId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...extraValues,
      } as Record<string, unknown>)
      .returning();

    if (!row) {
      throw new Error(`Failed to create ${entityName.toLowerCase()} — INSERT returned no rows`);
    }

    await audit(tx, {
      eventType: events.created,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} created`,
      systemId,
    });
    if (cfg.webhookEvents) {
      await dispatchWebhookEvent(
        tx,
        systemId,
        cfg.webhookEvents.created,
        cfg.webhookEvents.buildPayload(entityId),
      );
    }

    return toResult(row as TRow);
  });
}
