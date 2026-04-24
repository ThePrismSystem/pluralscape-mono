import type { AccountId, FriendConnectionId, FriendNotificationPreferenceId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

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

/**
 * Server-visible FriendNotificationPreference metadata — raw Drizzle row
 * shape.
 *
 * Plaintext entity. The domain type extends `AuditMetadata` (which carries
 * a `version`), but the `friend_notification_preferences` table is not
 * `versioned()` — row operations are idempotent per (account, friend
 * connection) pair, so the column is omitted. `archived` relaxes from the
 * `false` literal to the raw boolean column, and `archivedAt` covers the
 * archivable consistency check.
 */
export type FriendNotificationPreferenceServerMetadata = Omit<
  FriendNotificationPreference,
  "version" | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/**
 * JSON-wire representation of a FriendNotificationPreference. Derived from
 * the domain type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`.
 */
export type FriendNotificationPreferenceWire = Serialize<FriendNotificationPreference>;
