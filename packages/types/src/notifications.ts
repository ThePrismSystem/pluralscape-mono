import type {
  AccountId,
  DeviceTokenId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
  NotificationConfigId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** Platforms that can receive push notifications. */
export type DeviceTokenPlatform = "ios" | "android" | "web";

/**
 * A registered device push token.
 * T3 (all fields) — server must read the token to deliver push notifications.
 */
export interface DeviceToken extends AuditMetadata {
  readonly id: DeviceTokenId;
  readonly systemId: SystemId;
  readonly platform: DeviceTokenPlatform;
  readonly token: string;
  readonly lastActiveAt: UnixMillis;
}

/** Events that can trigger a notification. */
export type NotificationEventType =
  | "switch-reminder"
  | "check-in-due"
  | "acknowledgement-requested"
  | "message-received"
  | "sync-conflict"
  | "friend-switch-alert";

/** Per-event notification configuration. */
export interface NotificationConfig extends AuditMetadata {
  readonly id: NotificationConfigId;
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly pushEnabled: boolean;
  readonly archived: false;
}

/** An archived notification config. */
export type ArchivedNotificationConfig = Archived<NotificationConfig>;

/** A notification payload ready for delivery. */
export interface NotificationPayload {
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>> | null;
  readonly createdAt: UnixMillis;
}

/** Notification event types relevant to friend connections. */
export type FriendNotificationEventType = "friend-switch-alert";

/** Configures which notification events a friend receives. */
export interface FriendNotificationPreference extends AuditMetadata {
  readonly id: FriendNotificationPreferenceId;
  readonly friendConnectionId: FriendConnectionId;
  readonly accountId: AccountId;
  readonly enabledEventTypes: readonly FriendNotificationEventType[];
  readonly archived: false;
}

/** An archived friend notification preference. */
export type ArchivedFriendNotificationPreference = Archived<FriendNotificationPreference>;
