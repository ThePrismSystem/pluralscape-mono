import { notificationConfigs } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_PAGE_LIMIT } from "../service.constants.js";

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
    id: brandId<NotificationConfigId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    eventType: row.eventType,
    enabled: row.enabled,
    pushEnabled: row.pushEnabled,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Insert a new notification config row with the given overrides merged
 * over defaults (enabled: true, pushEnabled: true).
 *
 * Shared by {@link getOrCreateNotificationConfig} and
 * {@link updateNotificationConfig} to avoid duplicating the insert block.
 */
async function insertNotificationConfig(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  eventType: NotificationEventType,
  overrides: { readonly enabled?: boolean; readonly pushEnabled?: boolean } = {},
): Promise<NotificationConfigResult> {
  const timestamp = now();
  const id = brandId<NotificationConfigId>(createId(ID_PREFIXES.notificationConfig));

  const [created] = await tx
    .insert(notificationConfigs)
    .values({
      id,
      systemId,
      eventType,
      enabled: overrides.enabled ?? true,
      pushEnabled: overrides.pushEnabled ?? true,
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

    return insertNotificationConfig(tx, systemId, eventType);
  });
}

/**
 * Update an existing notification config's enabled/pushEnabled flags.
 * Auto-creates with defaults merged with the provided params if no
 * config exists for the given event type.
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

    const setClause: Partial<typeof notificationConfigs.$inferInsert> = { updatedAt: timestamp };
    if (params.enabled !== undefined) setClause.enabled = params.enabled;
    if (params.pushEnabled !== undefined) setClause.pushEnabled = params.pushEnabled;

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
      const result = await insertNotificationConfig(tx, systemId, eventType, params);

      await audit(tx, {
        eventType: AUDIT_CONFIG_UPDATED,
        actor: { kind: "account", id: auth.accountId },
        detail: `Notification config for ${eventType} created and updated`,
        accountId: auth.accountId,
        systemId,
      });

      return result;
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
      )
      .limit(MAX_PAGE_LIMIT);

    return rows.map(toNotificationConfigResult);
  });
}
