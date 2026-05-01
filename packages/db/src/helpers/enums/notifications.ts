/**
 * Notification and device const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import { type DeviceTokenPlatform, type NotificationEventType } from "@pluralscape/types";

export const DEVICE_TOKEN_PLATFORMS = [
  "ios",
  "android",
  "web",
] as const satisfies readonly DeviceTokenPlatform[];

export const NOTIFICATION_EVENT_TYPES = [
  "switch-reminder",
  "check-in-due",
  "acknowledgement-requested",
  "message-received",
  "sync-conflict",
  "friend-switch-alert",
] as const satisfies readonly NotificationEventType[];
