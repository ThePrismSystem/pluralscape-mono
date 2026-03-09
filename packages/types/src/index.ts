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
  MemberPhotoId,
  SwitchId,
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

// ── Fronting ────────────────────────────────────────────────────────
export type {
  FrontingType,
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  Switch,
  CustomFront,
  CoFrontState,
} from "./fronting.js";

// ── Privacy ────────────────────────────────────────────────────────
export type {
  PrivacyBucket,
  BucketContentTag,
  BucketVisibilityScope,
  KeyGrant,
  FriendConnectionStatus,
  FriendConnection,
  FriendCode,
  BucketAccessCheck,
} from "./privacy.js";

// ── Structure ──────────────────────────────────────────────────────
export type {
  RelationshipType,
  Relationship,
  ArchitectureType,
  OriginType,
  DiscoveryStatus,
  LayerAccessType,
  Subsystem,
  SideSystem,
  Layer,
  SubsystemMembership,
  SideSystemMembership,
  LayerMembership,
} from "./structure.js";

// ── Groups ─────────────────────────────────────────────────────────
export type { Group, GroupMembership, GroupTree, GroupMoveOperation } from "./groups.js";
