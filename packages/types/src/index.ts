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
  AuthKeyId,
  RecoveryKeyId,
  DeviceTransferRequestId,
  SyncDocumentId,
  SyncQueueItemId,
  SyncConflictId,
  ImportJobId,
  PKBridgeConfigId,
  AccountPurgeRequestId,
  HexColor,
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
  ArchivedCustomFront,
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
  OpenLayer,
  GatekeptLayer,
  SubsystemMembership,
  SideSystemMembership,
  LayerMembership,
} from "./structure.js";

// ── Auth ──────────────────────────────────────────────────────
export type {
  AuthKeyType,
  DeviceTransferStatus,
  Account,
  AuthKey,
  Session,
  DeviceInfo,
  RecoveryKey,
  LoginCredentials,
  RegistrationInput,
  DeviceTransferRequest,
  DeviceTransferPayload,
} from "./auth.js";

// ── Encryption ────────────────────────────────────────────────
export type {
  Encrypted,
  BucketEncrypted,
  EncryptionAlgorithm,
  EncryptedBlob,
  EncryptedString,
  ServerMember,
  ClientMember,
  ServerFrontingSession,
  ClientFrontingSession,
  ServerGroup,
  ClientGroup,
  ServerSubsystem,
  ClientSubsystem,
  ServerRelationship,
  ClientRelationship,
  DecryptFn,
  EncryptFn,
} from "./encryption.js";

// ── Sync ──────────────────────────────────────────────────────
export type {
  SyncOperation,
  SyncResolution,
  SyncIndicatorStatus,
  SyncDocument,
  SyncQueueItem,
  SyncConflict,
  SyncState,
  SyncIndicator,
} from "./sync.js";

// ── Groups ─────────────────────────────────────────────────────────
export type {
  Group,
  ArchivedGroup,
  GroupMembership,
  GroupTree,
  GroupMoveOperation,
} from "./groups.js";

// ── PK Bridge ────────────────────────────────────────────────────
export type {
  PKSyncDirection,
  PKSyncStatus,
  PKSyncableEntityType,
  PKSyncErrorCode,
  PKBridgeConfig,
  PKMemberMapping,
  PKGroupMapping,
  PKSwitchMapping,
  PKEntityMapping,
  PKSyncState,
  PKSyncError,
} from "./pk-bridge.js";

// ── Import/Export ────────────────────────────────────────────────
export type {
  SPImportMember,
  SPImportGroup,
  SPImportFrontingSession,
  SPImportCustomField,
  SPImportCustomFieldValue,
  SPImportNote,
  SPImportChatMessage,
  SPImportBoardMessage,
  SPImportPoll,
  SPImportTimer,
  SPImportPrivacyBucket,
  SPImportFriend,
  SPImportPayload,
  PKProxyTag,
  PKImportMember,
  PKImportGroup,
  PKImportSwitch,
  PKImportPayload,
  ImportSource,
  ImportEntityType,
  ImportJobStatus,
  ImportProgress,
  ImportError,
  ImportJob,
  ExportFormat,
  ExportSection,
  DownloadableReport,
  ExportManifest,
  AccountPurgeStatus,
  ReportFormat,
  AccountPurgeRequest,
  MemberReport,
} from "./import-export.js";

// ── Runtime utilities ──────────────────────────────────────────────
export { createId, now, toISO } from "./runtime.js";
