import { notificationConfigs } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { narrowArchivableRow } from "../lib/archivable-row.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_PAGE_LIMIT } from "../service.constants.js";

import { invalidateSwitchAlertConfigCache } from "./switch-alert-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  Archivable,
  AuditEventType,
  FriendNotificationEventType,
  NotificationConfig,
  NotificationConfigId,
  NotificationEventType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/** Audit event: notification config was updated. */
const AUDIT_CONFIG_UPDATED: AuditEventType = "notification-config.updated";

/**
 * The only {@link NotificationEventType} currently surfaced through the
 * switch-alert dispatcher cache. Narrowing against this set avoids
 * invalidating keys the dispatcher never stores.
 */
const FRIEND_NOTIFICATION_EVENT_TYPES: readonly FriendNotificationEventType[] = [
  "friend-switch-alert",
];

function isFriendNotificationEventType(
  eventType: NotificationEventType,
): eventType is FriendNotificationEventType {
  return (FRIEND_NOTIFICATION_EVENT_TYPES as readonly NotificationEventType[]).includes(eventType);
}

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

function toNotificationConfigResult(
  config: Archivable<NotificationConfig>,
): NotificationConfigResult {
  return {
    id: config.id,
    systemId: config.systemId,
    eventType: config.eventType,
    enabled: config.enabled,
    pushEnabled: config.pushEnabled,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Insert a new notification config row with the given overrides merged over
 * defaults (`enabled: false, pushEnabled: false` — fail-closed per VALUES.md).
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
      enabled: overrides.enabled ?? false,
      pushEnabled: overrides.pushEnabled ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      archived: false,
      archivedAt: null,
    })
    .returning();

  if (!created) {
    throw new Error("Notification config insert returned no rows");
  }

  return toNotificationConfigResult(narrowArchivableRow<NotificationConfig>(created));
}

// ── Service functions ────────────────────────────────────────────────

/**
 * Get the notification config for a specific event type, creating it with
 * defaults (`enabled: false, pushEnabled: false`) if it doesn't exist yet.
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
      return toNotificationConfigResult(narrowArchivableRow<NotificationConfig>(existing));
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

  // Cache invalidation MUST run after the transaction commits. Firing it
  // inside the transaction races with concurrent readers that can repopulate
  // the cache with the pre-commit row between invalidation and commit,
  // leaving the stale value until the TTL expires.
  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
      const inserted = await insertNotificationConfig(tx, systemId, eventType, params);

      await audit(tx, {
        eventType: AUDIT_CONFIG_UPDATED,
        actor: { kind: "account", id: auth.accountId },
        detail: `Notification config for ${eventType} created and updated`,
        accountId: auth.accountId,
        systemId,
      });

      return inserted;
    }

    await audit(tx, {
      eventType: AUDIT_CONFIG_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: `Notification config for ${eventType} updated`,
      accountId: auth.accountId,
      systemId,
    });

    return toNotificationConfigResult(narrowArchivableRow<NotificationConfig>(updated));
  });

  if (isFriendNotificationEventType(eventType)) {
    invalidateSwitchAlertConfigCache(systemId, eventType);
  }
  return result;
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

    return rows.map((row) =>
      toNotificationConfigResult(narrowArchivableRow<NotificationConfig>(row)),
    );
  });
}
