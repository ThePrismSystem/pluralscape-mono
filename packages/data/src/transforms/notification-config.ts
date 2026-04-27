import { brandId, toUnixMillis } from "@pluralscape/types";

import type {
  Archived,
  NotificationConfig,
  NotificationConfigId,
  NotificationConfigWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `notificationConfig.list`. */
export interface NotificationConfigPage {
  readonly data: readonly NotificationConfigWire[];
  readonly nextCursor: string | null;
}

/**
 * Narrow a single notification config wire object into a `NotificationConfig`
 * or `Archived<NotificationConfig>`. Re-brands IDs/timestamps stripped by
 * `Serialize<>` at the wire boundary.
 */
export function narrowNotificationConfig(
  raw: NotificationConfigWire,
): NotificationConfig | Archived<NotificationConfig> {
  const base = {
    id: brandId<NotificationConfigId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    eventType: raw.eventType,
    enabled: raw.enabled,
    pushEnabled: raw.pushEnabled,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived notificationConfig missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/** Narrow a paginated notification config list result. */
export function narrowNotificationConfigPage(raw: NotificationConfigPage): {
  data: (NotificationConfig | Archived<NotificationConfig>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowNotificationConfig),
    nextCursor: raw.nextCursor,
  };
}
