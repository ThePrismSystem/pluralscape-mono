// @pluralscape/types — shared TypeScript domain types

// ── IDs ─────────────────────────────────────────────────────────────
export type {
  Brand,
  IdPrefixBrandMap,
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
  LifecycleEventId,
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
  ExportRequestId,
  JobId,
  SubscriptionId,
  WebhookDeliveryId,
  FrontingReportId,
  FriendNotificationPreferenceId,
  FrontingCommentId,
  BucketKeyRotationId,
  BucketRotationItemId,
  SystemSnapshotId,
  BiometricTokenId,
  StorageKey,
  HexColor,
  SlugHash,
  EntityType,
} from "./ids.js";
export { ID_PREFIXES } from "./ids.js";

// ── Timestamps ──────────────────────────────────────────────────────
export type { UnixMillis, ISOTimestamp } from "./timestamps.js";

// ── Pagination ──────────────────────────────────────────────────────
export type { PaginationCursor, PaginatedResult, OffsetPaginationParams } from "./pagination.js";
export { toCursor } from "./pagination.js";

// ── Results ─────────────────────────────────────────────────────────
export type {
  Result,
  ApiError,
  ApiErrorResponse,
  ApiResponse,
  ValidationError,
} from "./results.js";

// ── Utility types ───────────────────────────────────────────────────
export type {
  CreateInput,
  UpdateInput,
  DeepReadonly,
  DateRange,
  AuditMetadata,
  Archived,
  SortDirection,
  EntityReference,
} from "./utility.js";

// ── Image source ────────────────────────────────────────────────────
export type { ImageSource } from "./image-source.js";

// ── Identity ────────────────────────────────────────────────────────
export type {
  System,
  Member,
  KnownSaturationLevel,
  SaturationLevel,
  KnownTag,
  Tag,
  MemberPhoto,
  ArchivedMember,
  ArchivedMemberPhoto,
  MemberListItem,
  SystemListItem,
  SystemDuplicationScope,
} from "./identity.js";

// ── Fronting ────────────────────────────────────────────────────────
export type {
  FrontingType,
  OuttriggerSentiment,
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  ArchivedFrontingSession,
  FrontingComment,
  ArchivedFrontingComment,
  Switch,
  ArchivedSwitch,
  CustomFront,
  ArchivedCustomFront,
  CoFrontState,
} from "./fronting.js";

// ── Privacy ────────────────────────────────────────────────────────
export type {
  PrivacyBucket,
  ArchivedPrivacyBucket,
  BucketContentEntityType,
  BucketContentTag,
  BucketVisibilityScope,
  KeyGrant,
  FriendConnectionStatus,
  FriendVisibilitySettings,
  FriendConnection,
  ArchivedFriendConnection,
  FriendCode,
  ArchivedFriendCode,
  BucketAccessCheck,
  FriendBucketAssignment,
} from "./privacy.js";

// ── Structure ──────────────────────────────────────────────────────
export type {
  RelationshipType,
  Relationship,
  ArchivedRelationship,
  KnownArchitectureType,
  ArchitectureType,
  StructureVisualProps,
  OriginType,
  DiscoveryStatus,
  SystemProfile,
  LayerAccessType,
  Subsystem,
  ArchivedSubsystem,
  SideSystem,
  ArchivedSideSystem,
  Layer,
  ArchivedLayer,
  OpenLayer,
  GatekeptLayer,
  SubsystemMembership,
  SideSystemMembership,
  LayerMembership,
  SubsystemLayerLink,
  SubsystemSideSystemLink,
  SideSystemLayerLink,
} from "./structure.js";

// ── Auth ──────────────────────────────────────────────────────
export type {
  AuthKeyType,
  AccountType,
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
  T1EncryptedBlob,
  T2EncryptedBlob,
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
  ServerChannel,
  ClientChannel,
  ServerChatMessage,
  ClientChatMessage,
  ServerBoardMessage,
  ClientBoardMessage,
  ServerNote,
  ClientNote,
  ServerFieldDefinition,
  ClientFieldDefinition,
  ServerFieldValue,
  ClientFieldValue,
  ServerInnerWorldEntity,
  ClientInnerWorldEntity,
  ServerInnerWorldRegion,
  ClientInnerWorldRegion,
  ServerLifecycleEvent,
  ClientLifecycleEvent,
  ServerCustomFront,
  ClientCustomFront,
  ServerJournalEntry,
  ClientJournalEntry,
  ServerWikiPage,
  ClientWikiPage,
  ServerMemberPhoto,
  ClientMemberPhoto,
  ServerPoll,
  ClientPoll,
  ServerAcknowledgementRequest,
  ClientAcknowledgementRequest,
  ServerSideSystem,
  ClientSideSystem,
  ServerLayer,
  ClientLayer,
  ServerTimerConfig,
  ClientTimerConfig,
  ServerFrontingComment,
  ClientFrontingComment,
  ServerPollVote,
  ClientPollVote,
  ServerAuditLogEntry,
  ClientAuditLogEntry,
  DecryptFn,
  EncryptFn,
  ServerResponseData,
  ClientResponseData,
} from "./encryption.js";

// ── Server-safe enforcement ────────────────────────────────────────
export type { ServerSafe } from "./server-safe.js";
export { serverSafe } from "./server-safe.js";

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
  ExportRequestStatus,
  ExportSection,
  DownloadableReport,
  ExportManifest,
  ExportRequest,
  AccountPurgeStatus,
  ReportFormat,
  AccountPurgeRequest,
  MemberReport,
  SystemOverviewReport,
} from "./import-export.js";

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
export type {
  BackoffStrategy,
  JobType,
  JobStatus,
  JobPayloadMap,
  RetryPolicy,
  JobResult,
  JobDefinition,
} from "./jobs.js";

// ── Blob ──────────────────────────────────────────────────────
export type {
  EncryptionTier,
  BlobPurpose,
  BlobMetadata,
  ArchivedBlobMetadata,
  BlobUploadRequest,
  BlobDownloadRef,
} from "./blob.js";

// ── Audit log ─────────────────────────────────────────────────
export type { AuditEventType, AuditActor, AuditLogEntry, SetupStepName } from "./audit-log.js";

// ── Webhooks ──────────────────────────────────────────────────
export type {
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookConfig,
  ArchivedWebhookConfig,
  PlaintextWebhookPayload,
  EncryptedWebhookPayload,
  WebhookDeliveryPayload,
  WebhookDelivery,
  ArchivedWebhookDelivery,
} from "./webhooks.js";

// ── Notifications ─────────────────────────────────────────────
export type {
  DeviceTokenPlatform,
  DeviceToken,
  NotificationEventType,
  NotificationConfig,
  ArchivedNotificationConfig,
  NotificationPayload,
  FriendNotificationEventType,
  FriendNotificationPreference,
  ArchivedFriendNotificationPreference,
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

// ── Communication ─────────────────────────────────────────────────
export type {
  Channel,
  ArchivedChannel,
  ChatMessage,
  ArchivedChatMessage,
  BoardMessage,
  ArchivedBoardMessage,
  Note,
  ArchivedNote,
  PollOption,
  PollKind,
  Poll,
  ArchivedPoll,
  PollVote,
  ArchivedPollVote,
  AcknowledgementRequest,
  ArchivedAcknowledgementRequest,
} from "./communication.js";

// ── Lifecycle ─────────────────────────────────────────────────────
export type {
  SplitEvent,
  FusionEvent,
  MergeEvent,
  UnmergeEvent,
  DormancyStartEvent,
  DormancyEndEvent,
  DiscoveryEvent,
  ArchivalEvent,
  SubsystemFormationEvent,
  FormChangeEvent,
  NameChangeEvent,
  StructureMoveEvent,
  InnerworldMoveEvent,
  LifecycleEvent,
  LifecycleEventType,
} from "./lifecycle.js";

// ── Custom fields ─────────────────────────────────────────────────
export type {
  FieldType,
  FieldBucketVisibility,
  FieldDefinition,
  ArchivedFieldDefinition,
  FieldValue,
  FieldValueUnion,
} from "./custom-fields.js";

// ── Journal ───────────────────────────────────────────────────────
export type {
  HeadingLevel,
  JournalBlockType,
  JournalBlock,
  ParagraphBlock,
  HeadingBlock,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  ImageBlock,
  DividerBlock,
  MemberLinkBlock,
  EntityLinkBlock,
  EntityLink,
  MemberFrontingSnapshotEntry,
  CustomFrontFrontingSnapshotEntry,
  FrontingSnapshotEntry,
  FrontingSnapshot,
  JournalEntry,
  ArchivedJournalEntry,
  WikiPage,
  ArchivedWikiPage,
} from "./journal.js";

// ── Timer ─────────────────────────────────────────────────────────
export type {
  TimerConfig,
  ArchivedTimerConfig,
  CheckInRecord,
  ArchivedCheckInRecord,
} from "./timer.js";

// ── Key Rotation ─────────────────────────────────────────────────
export type {
  RotationState,
  RotationItemStatus,
  BucketKeyRotation,
  BucketRotationItem,
} from "./key-rotation.js";

// ── Analytics ─────────────────────────────────────────────────────
export type {
  Duration,
  DateRangePreset,
  DateRangeFilter,
  MemberFrontingBreakdown,
  FrontingAnalytics,
  FrontingReport,
  ChartDataset,
  ChartData,
  CoFrontingPair,
  CoFrontingAnalytics,
} from "./analytics.js";

// ── Innerworld ────────────────────────────────────────────────────
export type {
  VisualProperties,
  MemberEntity,
  LandmarkEntity,
  SubsystemEntity,
  SideSystemEntity,
  LayerEntity,
  InnerWorldEntity,
  ArchivedInnerWorldEntity,
  InnerWorldEntityType,
  InnerWorldRegion,
  ArchivedInnerWorldRegion,
  InnerWorldCanvas,
} from "./innerworld.js";

// ── Littles Safe Mode ─────────────────────────────────────────────
export type {
  SafeModeUIFlags,
  SafeModeContentItem,
  LittlesSafeModeConfig,
} from "./littles-safe-mode.js";

// ── Nomenclature ──────────────────────────────────────────────────
export type {
  TermCategory,
  CanonicalTerm,
  NomenclatureSettings,
  TermPreset,
} from "./nomenclature.js";
export { DEFAULT_TERM_PRESETS, createDefaultNomenclatureSettings } from "./nomenclature.js";

// ── i18n ──────────────────────────────────────────────────────────
export type {
  Locale,
  TranslationKey,
  TranslationMap,
  TextDirection,
  DateFormatPreference,
  NumberFormatPreference,
  LocaleConfig,
} from "./i18n.js";

// ── Settings ──────────────────────────────────────────────────────
export type {
  ThemePreference,
  AppLockConfig,
  NotificationPreferences,
  SyncPreferences,
  FriendRequestPolicy,
  PrivacyDefaults,
  SystemSettings,
} from "./settings.js";

// ── Snapshot ─────────────────────────────────────────────────────
export type {
  SnapshotTrigger,
  SnapshotSchedule,
  SystemSnapshot,
  SnapshotMember,
  SnapshotSubsystem,
  SnapshotSideSystem,
  SnapshotLayer,
  SnapshotRelationship,
  SnapshotGroup,
  SnapshotInnerworldRegion,
  SnapshotInnerworldEntity,
  SnapshotContent,
} from "./snapshot.js";

// ── API constants ─────────────────────────────────────────────────────
export type { RateLimitConfig, RateLimitCategory, ApiErrorCode } from "./api-constants.js";
export {
  RATE_LIMITS,
  API_ERROR_CODES,
  PAGINATION,
  SESSION_TIMEOUTS,
  LAST_ACTIVE_THROTTLE_MS,
  BLOB_SIZE_LIMITS,
  FRIEND_CODE,
  AUDIT_RETENTION,
  CLIENT_RETRY,
} from "./api-constants.js";

// ── Runtime utilities ──────────────────────────────────────────────
export { createId, now, toISO } from "./runtime.js";
