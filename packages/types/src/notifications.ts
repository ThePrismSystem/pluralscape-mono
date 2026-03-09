import type { EncryptedString } from "./encryption.js";
import type { DeviceTokenId, NotificationConfigId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** A registered device push token. */
export interface DeviceToken extends AuditMetadata {
  readonly id: DeviceTokenId;
  readonly systemId: SystemId;
  readonly platform: "ios" | "android" | "web";
  readonly token: EncryptedString;
  readonly lastActiveAt: UnixMillis;
}

/** Events that can trigger a notification. */
export type NotificationEventType =
  | "switch-reminder"
  | "check-in-due"
  | "acknowledgement-requested"
  | "message-received"
  | "sync-conflict";

/** Per-event notification configuration. */
export interface NotificationConfig extends AuditMetadata {
  readonly id: NotificationConfigId;
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly pushEnabled: boolean;
}

/** A notification payload ready for delivery. */
export interface NotificationPayload {
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>> | null;
  readonly createdAt: UnixMillis;
}
