import type { Plaintext } from "./encryption.js";
import type { AuditLogEntryId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** The category of audit event. */
export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.key-created"
  | "auth.key-revoked"
  | "data.export"
  | "data.import"
  | "data.purge"
  | "settings.changed"
  | "member.created"
  | "member.archived"
  | "sharing.granted"
  | "sharing.revoked";

/** An append-only audit log entry. */
export interface AuditLogEntry {
  readonly id: AuditLogEntryId;
  readonly systemId: SystemId;
  readonly eventType: AuditEventType;
  readonly timestamp: UnixMillis;
  readonly actorId: string;
  readonly detail: Plaintext<string> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
