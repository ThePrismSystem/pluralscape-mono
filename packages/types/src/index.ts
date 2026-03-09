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
  JobId,
  SubscriptionId,
  WebhookDeliveryId,
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
  Plaintext,
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

// ── API keys ──────────────────────────────────────────────────
export type {
  ApiKeyToken,
  ApiKeyScope,
  MetadataApiKey,
  CryptoApiKey,
  ApiKey,
  ApiKeyWithSecret,
} from "./api-keys.js";

// ── Jobs ──────────────────────────────────────────────────────
export type { JobType, JobStatus, RetryPolicy, JobResult, JobDefinition } from "./jobs.js";

// ── Blob ──────────────────────────────────────────────────────
export type { BlobPurpose, BlobMetadata, BlobUploadRequest, BlobDownloadRef } from "./blob.js";

// ── Audit log ─────────────────────────────────────────────────
export type { AuditEventType, AuditLogEntry } from "./audit-log.js";

// ── Webhooks ──────────────────────────────────────────────────
export type {
  WebhookEventType,
  WebhookConfig,
  PlaintextWebhookPayload,
  EncryptedWebhookPayload,
  WebhookDeliveryPayload,
  WebhookDelivery,
} from "./webhooks.js";

// ── Notifications ─────────────────────────────────────────────
export type {
  DeviceToken,
  NotificationEventType,
  NotificationConfig,
  NotificationPayload,
} from "./notifications.js";

// ── Realtime ──────────────────────────────────────────────────
export type {
  FrontingChangedEvent,
  MemberUpdatedEvent,
  SyncStateChangedEvent,
  MessageReceivedEvent,
  PresenceHeartbeatEvent,
  ConnectionErrorEvent,
  WebSocketEvent,
  WebSocketEventType,
  SSEEvent,
  RealtimeSubscription,
  WebSocketConnectionState,
} from "./realtime.js";

// ── Search ────────────────────────────────────────────────────
export type {
  SearchIndex,
  SearchableEntityType,
  SearchQuery,
  SearchResultItem,
  SearchResult,
} from "./search.js";

// ── Runtime utilities ──────────────────────────────────────────────
export { createId, now, toISO } from "./runtime.js";
