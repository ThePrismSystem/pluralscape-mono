import type { Plaintext } from "./encryption.js";
import type { AccountId, ApiKeyId, AuditLogEntryId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** The category of audit event. */
export type AuditEventType =
  | "auth.register"
  | "auth.login"
  | "auth.login-failed"
  | "auth.logout"
  | "auth.password-changed"
  | "auth.recovery-key-used"
  | "auth.key-created"
  | "auth.key-revoked"
  | "data.export"
  | "data.import"
  | "data.purge"
  | "settings.changed"
  | "member.created"
  | "member.archived"
  | "sharing.granted"
  | "sharing.revoked"
  | "bucket.key_rotation.initiated"
  | "bucket.key_rotation.chunk_completed"
  | "bucket.key_rotation.completed"
  | "bucket.key_rotation.failed"
  | "device.security.jailbreak_warning_shown"
  | "auth.password-reset-via-recovery"
  | "auth.recovery-key-regenerated"
  | "auth.device-transfer-initiated"
  | "auth.device-transfer-completed"
  | "auth.email-changed"
  | "system.created"
  | "system.profile-updated"
  | "system.deleted";

/** The actor who performed an audit-logged action. */
export type AuditActor =
  | { readonly kind: "account"; readonly id: AccountId }
  | { readonly kind: "api-key"; readonly id: ApiKeyId }
  | { readonly kind: "system"; readonly id: SystemId };

/** An append-only audit log entry. */
export interface AuditLogEntry {
  readonly id: AuditLogEntryId;
  readonly systemId: SystemId;
  readonly eventType: AuditEventType;
  readonly createdAt: UnixMillis;
  readonly actor: AuditActor;
  readonly detail: Plaintext<string> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
