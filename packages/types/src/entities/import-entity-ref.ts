import type {
  AccountId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  ImportEntityRefId,
  JournalEntryId,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  SystemId,
  TimerId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { ImportEntityType, ImportSourceFormat } from "./import-job.js";

interface ImportEntityRefBase {
  readonly id: ImportEntityRefId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  /** Opaque identifier from the source system (e.g., Mongo ObjectId for SP). */
  readonly sourceEntityId: string;
  readonly importedAt: UnixMillis;
}

/**
 * Maps each ImportEntityType to the branded Pluralscape ID it resolves to.
 * Used to type-scope `ImportEntityRef.pluralscapeEntityId` via a
 * discriminated union. "switch" and "unknown" resolve to raw string because
 * no dedicated branded IDs exist for those categories.
 */
export interface ImportEntityTargetIdMap {
  readonly member: MemberId;
  readonly group: GroupId;
  readonly "custom-front": CustomFrontId;
  readonly "fronting-session": FrontingSessionId;
  readonly "fronting-comment": FrontingCommentId;
  readonly switch: string;
  readonly "custom-field": FieldDefinitionId;
  readonly "field-definition": FieldDefinitionId;
  readonly "field-value": FieldValueId;
  readonly note: NoteId;
  readonly "journal-entry": JournalEntryId;
  readonly "chat-message": MessageId;
  readonly "board-message": BoardMessageId;
  readonly "channel-category": ChannelId;
  readonly channel: ChannelId;
  readonly poll: PollId;
  readonly timer: TimerId;
  readonly "privacy-bucket": BucketId;
  readonly "system-profile": SystemId;
  readonly "system-settings": SystemId;
  readonly unknown: string;
}

/**
 * A source-entity to target-entity mapping recorded during an import.
 * Enables idempotent re-imports and cross-device dedup.
 *
 * Discriminated on `sourceEntityType` so consumers get the correct branded
 * target ID via narrowing (no manual cast).
 */
export type ImportEntityRef = {
  [K in ImportEntityType]: ImportEntityRefBase & {
    readonly sourceEntityType: K;
    readonly pluralscapeEntityId: ImportEntityTargetIdMap[K];
  };
}[ImportEntityType];
