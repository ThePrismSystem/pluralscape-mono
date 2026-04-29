import type { NotificationConfigId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archivable, Archived, AuditMetadata } from "../utility.js";

/** Events that can trigger a notification. */
export type NotificationEventType =
  | "switch-reminder"
  | "check-in-due"
  | "acknowledgement-requested"
  | "message-received"
  | "sync-conflict"
  | "friend-switch-alert";

/** Per-event notification configuration (live state). */
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
 * Server-visible NotificationConfig metadata.
 *
 * Discriminated union of the live and archived shapes — the database CHECK
 * invariant `(archived = true) = (archived_at IS NOT NULL)` is encoded in
 * the type system here. Produced from a flat Drizzle row at the read boundary
 * by `narrowArchivableRow` (apps/api/src/lib/archivable-row.ts).
 */
export type NotificationConfigServerMetadata = Archivable<NotificationConfig>;

/**
 * JSON-wire NotificationConfig (live or archived) — discriminated.
 *
 * `Serialize` distributes over the underlying union, so this type is the
 * discriminated wire union: `Serialize<NotificationConfig> |
 * Serialize<Archived<NotificationConfig>>`. Branded IDs and `UnixMillis`
 * are stripped at the wire boundary.
 */
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
