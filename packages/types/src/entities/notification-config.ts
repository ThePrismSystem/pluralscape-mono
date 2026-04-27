import type { NotificationConfigId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

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

/**
 * Server-visible NotificationConfig metadata — raw Drizzle row shape.
 *
 * Plaintext entity. Relaxes the domain's `archived: false` literal to the
 * raw boolean column and adds the nullable `archivedAt` that the
 * archivable-consistency check requires.
 */
export type NotificationConfigServerMetadata = Omit<NotificationConfig, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** JSON-wire NotificationConfig (live or archived). Branded IDs and UnixMillis get stripped at the wire boundary. */
export type NotificationConfigWire = Serialize<NotificationConfigServerMetadata>;

/** A notification payload ready for delivery. */
export interface NotificationPayload {
  readonly systemId: SystemId;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>> | null;
  readonly createdAt: UnixMillis;
}
