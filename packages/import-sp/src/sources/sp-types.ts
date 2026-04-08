/**
 * Raw Simply Plural collection types.
 *
 * These mirror the MongoDB document shapes returned by the SP API and emitted
 * into JSON exports. Source: `https://github.com/ApparyllisOrg/SimplyPluralApi`
 * — verify each interface against `src/api/v1/<collection>.ts` in that repo
 * before changing.
 *
 * Conventions:
 * - All field names match SP exactly. Do not rename to camelCase here.
 * - `_id` is the Mongo ObjectId (24-char hex string).
 * - Optional fields are `field?` (may be undefined). Nullable fields are
 *   `field: T | null`. The distinction matters for the Zod validators in
 *   `validators/sp-payload.ts`.
 * - Timestamps are Unix milliseconds (number) unless documented otherwise.
 */

/** Base shape — every SP document carries an `_id`. */
export interface SPDocument {
  readonly _id: string;
}

// ── users (cherry-picked) ────────────────────────────────────────────

/**
 * SP `users` collection. Fields here are the cherry-picked subset relevant to
 * Pluralscape `systems.encryptedData`. Many other fields exist on the SP
 * document and are intentionally ignored.
 */
export interface SPUser extends SPDocument {
  readonly username: string;
  readonly desc?: string | null;
  readonly avatarUrl?: string | null;
  readonly color?: string | null;
  readonly defaultPrivacyBucket?: string | null;
}

// ── private (cherry-picked) ──────────────────────────────────────────

/**
 * SP `private` collection. The user's per-account preferences. Cherry-picked
 * subset relevant to Pluralscape `system_settings.encryptedData`.
 */
export interface SPPrivate extends SPDocument {
  readonly locale?: string | null;
  readonly frontNotifs?: boolean;
  readonly messageBoardNotifs?: boolean;
}

// ── members ──────────────────────────────────────────────────────────

export interface SPMember extends SPDocument {
  readonly name: string;
  readonly desc?: string | null;
  readonly pronouns?: string | null;
  readonly color?: string | null;
  readonly avatarUrl?: string | null;
  readonly archived?: boolean;
  readonly archivedReason?: string | null;
  readonly preventTrusted?: boolean;
  readonly private?: boolean;
  /** Modern SP versions use bucket assignments instead of private/preventTrusted. */
  readonly buckets?: readonly string[];
  /** Map of customField._id → value. Extracted into field_values rows. */
  readonly info?: Readonly<Record<string, string>>;
  readonly frame?: string | null;
  readonly preventsFrontNotifs?: boolean;
  readonly receiveMessageBoardNotifs?: boolean;
  readonly supportDescMarkdown?: boolean;
  readonly created?: number;
  readonly lastOperationTime?: number;
}

// ── frontStatuses (custom fronts) ────────────────────────────────────

export interface SPFrontStatus extends SPDocument {
  readonly name: string;
  readonly desc?: string | null;
  readonly color?: string | null;
  readonly avatarUrl?: string | null;
  readonly preventTrusted?: boolean;
  readonly private?: boolean;
}

// ── groups ───────────────────────────────────────────────────────────

export interface SPGroup extends SPDocument {
  readonly name: string;
  readonly desc?: string | null;
  readonly color?: string | null;
  readonly parent?: string | null;
  readonly members: readonly string[];
  readonly preventTrusted?: boolean;
  readonly private?: boolean;
}

// ── customFields ─────────────────────────────────────────────────────

export interface SPCustomField extends SPDocument {
  readonly name: string;
  readonly type: string;
  readonly order: number;
  readonly preventTrusted?: boolean;
  readonly private?: boolean;
  readonly supportMarkdown?: boolean;
}

// ── frontHistory (fronting sessions) ─────────────────────────────────

export interface SPFrontHistory extends SPDocument {
  /** SP `member` is either a member._id or a frontStatus._id depending on `custom`. */
  readonly member: string;
  readonly custom: boolean;
  readonly live: boolean;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly customStatus?: string | null;
}

// ── comments (fronting comments) ─────────────────────────────────────

export interface SPComment extends SPDocument {
  /** Always references a frontHistory document (enforced by validateCollection in SP). */
  readonly documentId: string;
  readonly text: string;
  readonly time: number;
}

// ── notes (→ journal entries) ────────────────────────────────────────

export interface SPNote extends SPDocument {
  readonly title: string;
  readonly note: string;
  readonly date: number;
  readonly color?: string | null;
  readonly member: string;
  readonly supportMarkdown?: boolean;
}

// ── polls ────────────────────────────────────────────────────────────

export interface SPPollOption {
  readonly id: string;
  readonly name: string;
  readonly color?: string | null;
}

export interface SPPollVote {
  readonly id: string;
  readonly comment?: string | null;
  /** Either an SP user identifier or "veto" for veto votes. */
  readonly vote: string;
}

export interface SPPoll extends SPDocument {
  readonly name: string;
  readonly desc?: string | null;
  readonly endTime?: number | null;
  readonly custom?: boolean;
  readonly allowAbstain?: boolean;
  readonly allowVeto?: boolean;
  readonly options: readonly SPPollOption[];
  readonly votes?: readonly SPPollVote[];
}

// ── channelCategories + channels ─────────────────────────────────────

export interface SPChannelCategory extends SPDocument {
  readonly name: string;
  readonly description?: string | null;
  readonly order?: number;
}

export interface SPChannel extends SPDocument {
  readonly name: string;
  readonly description?: string | null;
  readonly parentCategory: string | null;
  readonly order?: number;
}

// ── chatMessages ─────────────────────────────────────────────────────

export interface SPChatMessage extends SPDocument {
  readonly channel: string;
  readonly writer: string;
  readonly message: string;
  readonly writtenAt: number;
  readonly replyTo?: string | null;
}

// ── boardMessages ────────────────────────────────────────────────────

export interface SPBoardMessage extends SPDocument {
  readonly title: string;
  readonly message: string;
  readonly writer: string;
  readonly writtenAt: number;
  readonly readBy?: readonly string[];
}

// ── privacyBuckets ───────────────────────────────────────────────────

export interface SPPrivacyBucket extends SPDocument {
  readonly name: string;
  readonly desc?: string | null;
  readonly color?: string | null;
  readonly icon?: string | null;
}

// ── friends + pendingFriendRequests ──────────────────────────────────

export interface SPFriend extends SPDocument {
  /** SP-side identifier for the remote user. Treated as opaque on Pluralscape. */
  readonly frienduid: string;
  readonly seenSources?: readonly string[];
  readonly seeMembers?: boolean;
  readonly seeFront?: boolean;
  readonly trusted?: boolean;
  readonly getFrontNotif?: boolean;
}

export interface SPPendingFriendRequest extends SPDocument {
  readonly sender: string;
  readonly receiver: string;
  readonly time: number;
  readonly message?: string | null;
}
