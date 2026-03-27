import { notificationConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AuditEventType,
  NotificationConfigId,
  NotificationEventType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/** Audit event: notification config was updated. */
const AUDIT_CONFIG_UPDATED: AuditEventType = "notification-config.updated";

// ── Types ────────────────────────────────────────────────────────────

export interface NotificationConfigResult {
  readonly id: NotificationConfigId;
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly pushEnabled: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ──────────────────────────────────────────────────────────

function toNotificationConfigResult(row: {
  id: string;
  systemId: string;
  eventType: NotificationEventType;
  enabled: boolean;
  pushEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}): NotificationConfigResult {
  return {
    id: row.id as NotificationConfigId,
    systemId: row.systemId as SystemId,
    eventType: row.eventType,
    enabled: row.enabled,
    pushEnabled: row.pushEnabled,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── Service functions ────────────────────────────────────────────────

/**
 * Get the notification config for a specific event type, creating it with
 * defaults (enabled: true, pushEnabled: true) if it doesn't exist yet.
 */
export async function getOrCreateNotificationConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: NotificationEventType,
  auth: AuthContext,
): Promise<NotificationConfigResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Try to find existing config first
    const [existing] = await tx
      .select()
      .from(notificationConfigs)
      .where(
        and(
          eq(notificationConfigs.systemId, systemId),
          eq(notificationConfigs.eventType, eventType),
          eq(notificationConfigs.archived, false),
        ),
      )
      .limit(1);

    if (existing) {
      return toNotificationConfigResult(existing);
    }

    // Create with defaults
    const timestamp = now();
    const id = createId(ID_PREFIXES.notificationConfig) as NotificationConfigId;

    const [created] = await tx
      .insert(notificationConfigs)
      .values({
        id,
        systemId,
        eventType,
        enabled: true,
        pushEnabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        archived: false,
        archivedAt: null,
      })
      .returning();

    if (!created) {
      throw new Error("Notification config insert returned no rows");
    }

    return toNotificationConfigResult(created);
  });
}

/**
 * Update an existing notification config's enabled/pushEnabled flags.
 * Returns 404 if no config exists for the given event type (caller should
 * use getOrCreate first).
 */
export async function updateNotificationConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: NotificationEventType,
  params: { readonly enabled?: boolean; readonly pushEnabled?: boolean },
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NotificationConfigResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const timestamp = now();

    const setClause: Record<string, unknown> = { updatedAt: timestamp };
    if (params.enabled !== undefined) setClause["enabled"] = params.enabled;
    if (params.pushEnabled !== undefined) setClause["pushEnabled"] = params.pushEnabled;

    const [updated] = await tx
      .update(notificationConfigs)
      .set(setClause)
      .where(
        and(
          eq(notificationConfigs.systemId, systemId),
          eq(notificationConfigs.eventType, eventType),
          eq(notificationConfigs.archived, false),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Notification config not found");
    }

    await audit(tx, {
      eventType: AUDIT_CONFIG_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: `Notification config for ${eventType} updated`,
      accountId: auth.accountId,
      systemId,
    });

    return toNotificationConfigResult(updated);
  });
}

/** List all non-archived notification configs for a system. */
export async function listNotificationConfigs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<readonly NotificationConfigResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select()
      .from(notificationConfigs)
      .where(
        and(eq(notificationConfigs.systemId, systemId), eq(notificationConfigs.archived, false)),
      );

    return rows.map(toNotificationConfigResult);
  });
}
