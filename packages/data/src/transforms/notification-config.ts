import { brandId, toUnixMillis } from "@pluralscape/types";

import type {
  Archivable,
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

/** Narrow a wire notification config; re-brands stripped IDs/timestamps. */
export function narrowNotificationConfig(
  raw: NotificationConfigWire,
): Archivable<NotificationConfig> {
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
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/** Narrow a paginated notification config list. */
export function narrowNotificationConfigPage(raw: NotificationConfigPage): {
  data: Archivable<NotificationConfig>[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowNotificationConfig),
    nextCursor: raw.nextCursor,
  };
}
