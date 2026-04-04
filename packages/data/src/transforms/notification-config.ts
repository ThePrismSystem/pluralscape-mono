import type { Archived, NotificationConfig, UnixMillis } from "@pluralscape/types";

// ── Wire types ────────────────────────────────────────────────────────

/** Wire shape returned by `notificationConfig.get` — derived from the `NotificationConfig` domain type. */
export type NotificationConfigRaw = Omit<NotificationConfig, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `notificationConfig.list`. */
export interface NotificationConfigPage {
  readonly data: readonly NotificationConfigRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Narrow a single notification config API result into a `NotificationConfig` or `Archived<NotificationConfig>`.
 */
export function narrowNotificationConfig(
  raw: NotificationConfigRaw,
): NotificationConfig | Archived<NotificationConfig> {
  const base = {
    id: raw.id,
    systemId: raw.systemId,
    eventType: raw.eventType,
    enabled: raw.enabled,
    pushEnabled: raw.pushEnabled,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived notificationConfig missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Narrow a paginated notification config list result.
 */
export function narrowNotificationConfigPage(raw: NotificationConfigPage): {
  data: (NotificationConfig | Archived<NotificationConfig>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowNotificationConfig),
    nextCursor: raw.nextCursor,
  };
}
