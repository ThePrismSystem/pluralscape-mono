import type { AccountId, FriendConnectionId, FriendNotificationPreferenceId } from "../ids.js";
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
