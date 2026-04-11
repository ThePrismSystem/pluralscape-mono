// scripts/sp-seed/fixtures/types.ts

/** A fixture-local symbolic id used to reference entities before server-side ObjectIds exist. */
export type FixtureRef = string;

/** A field value that is either a literal of type T, or a FixtureRef placeholder. */
export type RefOr<T> = T | FixtureRef;

/** A single fixture entry: a symbolic ref plus the POST body. */
export interface FixtureDef<TBody> {
  readonly ref: FixtureRef;
  readonly body: TBody;
}

// --- Entity body types (match SP API POST schemas) ---

export interface PrivacyBucketBody {
  readonly name: string;
  readonly desc: string;
  readonly color: string;
  readonly icon: string;
  /** Must match `^0|[a-z0-9]{6,}(:)?[a-z0-9]{0,}$`. */
  readonly rank: string;
}

export interface CustomFieldBody {
  readonly name: string;
  readonly supportMarkdown: boolean;
  /** 0-7 per SP schema. */
  readonly type: number;
  /** Must match `^0|[a-z0-9]{6,}(:)?[a-z0-9]{0,}$`. */
  readonly order: string;
}

export interface CustomFrontBody {
  readonly name: string;
}

export interface MemberBody {
  readonly name: string;
}

export interface GroupBody {
  readonly parent: RefOr<string>;
  readonly color: string;
  readonly name: string;
  readonly desc: string;
  readonly emoji: string;
  readonly members: readonly RefOr<string>[];
}

export interface FrontHistoryBody {
  readonly custom: boolean;
  readonly live: boolean;
  readonly startTime: number;
  readonly endTime?: number;
  readonly member: RefOr<string>;
}

export interface CommentBody {
  readonly time: number;
  readonly text: string;
  readonly documentId: RefOr<string>;
  readonly collection: string;
}

export interface NoteBody {
  readonly title: string;
  readonly note: string;
  readonly color: string;
  readonly member: RefOr<string>;
  readonly date: number;
}

export interface PollOption {
  readonly name: string;
  readonly color: string;
}

export interface PollBody {
  readonly name: string;
  readonly desc: string;
  readonly custom: boolean;
  readonly endTime: number;
  readonly options?: readonly PollOption[];
}

export interface ChannelCategoryBody {
  readonly name: string;
  readonly desc: string;
}

export interface ChannelBody {
  readonly name: string;
  readonly desc: string;
  readonly category?: RefOr<string>;
}

export interface ChatMessageBody {
  readonly message: string;
  readonly channel: RefOr<string>;
  readonly writer: RefOr<string>;
  readonly writtenAt: number;
}

export interface BoardMessageBody {
  readonly title: string;
  readonly message: string;
  readonly writtenBy: RefOr<string>;
  readonly writtenFor: RefOr<string>;
  readonly read: boolean;
  readonly writtenAt: number;
  readonly supportMarkdown: boolean;
}

export interface UserProfilePatch {
  readonly desc: string;
  readonly color: string;
}

/** The full fixture set for a mode. Array order = creation order. */
export interface EntityFixtures {
  readonly privacyBuckets: readonly FixtureDef<PrivacyBucketBody>[];
  readonly customFields: readonly FixtureDef<CustomFieldBody>[];
  readonly customFronts: readonly FixtureDef<CustomFrontBody>[];
  readonly members: readonly FixtureDef<MemberBody>[];
  readonly groups: readonly FixtureDef<GroupBody>[];
  readonly frontHistory: readonly FixtureDef<FrontHistoryBody>[];
  readonly comments: readonly FixtureDef<CommentBody>[];
  readonly notes: readonly FixtureDef<NoteBody>[];
  readonly polls: readonly FixtureDef<PollBody>[];
  readonly channelCategories: readonly FixtureDef<ChannelCategoryBody>[];
  readonly channels: readonly FixtureDef<ChannelBody>[];
  readonly chatMessages: readonly FixtureDef<ChatMessageBody>[];
  readonly boardMessages: readonly FixtureDef<BoardMessageBody>[];
  readonly profilePatch: UserProfilePatch;
}

/** Array-valued keys of EntityFixtures (excluding profilePatch). */
export type EntityTypeKey = Exclude<keyof EntityFixtures, "profilePatch">;

/** Iteration order for seed and ref resolution. Must match dependency order. */
export const ENTITY_TYPES_IN_ORDER: readonly EntityTypeKey[] = [
  "privacyBuckets",
  "customFields",
  "customFronts",
  "members",
  "groups",
  "frontHistory",
  "comments",
  "notes",
  "polls",
  "channelCategories",
  "channels",
  "chatMessages",
  "boardMessages",
] as const;
