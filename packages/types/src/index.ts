// @pluralscape/types — shared TypeScript domain types

// ── IDs ─────────────────────────────────────────────────────────────
export type {
  Brand,
  SystemId,
  MemberId,
  GroupId,
  BucketId,
  ChannelId,
  MessageId,
  NoteId,
  PollId,
  RelationshipId,
  SubsystemId,
  FieldDefinitionId,
  FieldValueId,
  SessionId,
  EventId,
  AccountId,
  BlobId,
  ApiKeyId,
  WebhookId,
  TimerId,
  JournalEntryId,
  WikiPageId,
  SideSystemId,
  LayerId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  AuditLogEntryId,
  BoardMessageId,
  AcknowledgementId,
  CheckInRecordId,
  FriendConnectionId,
  KeyGrantId,
  FrontingSessionId,
  CustomFrontId,
  FriendCodeId,
  PollVoteId,
  DeviceTokenId,
  NotificationConfigId,
  SystemSettingsId,
  PollOptionId,
  EntityType,
} from "./ids.js";
export { ID_PREFIXES } from "./ids.js";

// ── Timestamps ──────────────────────────────────────────────────────
export type { UnixMillis, ISOTimestamp } from "./timestamps.js";

// ── Pagination ──────────────────────────────────────────────────────
export type { PaginationCursor, PaginatedResult, OffsetPaginationParams } from "./pagination.js";

// ── Results ─────────────────────────────────────────────────────────
export type { Result, ApiError, ApiResponse, ValidationError } from "./results.js";

// ── Utility types ───────────────────────────────────────────────────
export type {
  CreateInput,
  UpdateInput,
  DeepReadonly,
  DateRange,
  AuditMetadata,
  SortDirection,
  EntityReference,
} from "./utility.js";

// ── Identity ────────────────────────────────────────────────────────
export type {
  System,
  Member,
  CompletenessLevel,
  KnownRoleTag,
  RoleTag,
  MemberPhoto,
  ArchivedMember,
  MemberListItem,
} from "./identity.js";
