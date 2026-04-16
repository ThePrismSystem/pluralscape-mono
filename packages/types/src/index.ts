// @pluralscape/types — shared TypeScript domain types

// ── Crypto key brands ────────────────────────────────────────────────
export type { KdfMasterKey } from "./crypto-keys.js";

// ── IDs ─────────────────────────────────────────────────────────────
export type {
  Brand,
  IdPrefixBrandMap,
  SystemId,
  MemberId,
  GroupId,
  GroupMembershipKey,
  BucketId,
  ChannelId,
  MessageId,
  NoteId,
  PollId,
  RelationshipId,
  SystemStructureEntityTypeId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityAssociationId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
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
  InnerWorldCanvasId,
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
  AuthKeyId,
  RecoveryKeyId,
  DeviceTransferRequestId,
  SyncDocumentId,
  SyncChangeId,
  SyncSnapshotId,
  ImportJobId,
  ImportEntityRefId,
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
  RecoveryKeyDisplay,
  ChecksumHex,
  EntityType,
  EntityTypeIdMap,
  AssertAllPrefixesMapped,
  AssertAllEntityTypesMapped,
} from "./ids.js";
export { ID_PREFIXES } from "./ids.js";

// ── Brand utilities ────────────────────────────────────────────────
export { brandId } from "./brand-utils.js";

// ── Checksum ─────────────────────────────────────────────────────
export { toChecksumHex } from "./checksum.js";

// ── Timestamps ──────────────────────────────────────────────────────
export type { UnixMillis, ISOTimestamp } from "./timestamps.js";
export { toUnixMillis, toUnixMillisOrNull } from "./timestamps.js";

// ── Pagination ──────────────────────────────────────────────────────
export type { PaginationCursor, PaginatedResult, OffsetPaginationParams } from "./pagination.js";
export { CursorInvalidError } from "./pagination.js";

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
  CreateMemberBody,
  UpdateMemberBody,
  CreateMemberPhotoBody,
  DuplicateMemberBody,
} from "./identity.js";

// ── Fronting ────────────────────────────────────────────────────────
export type {
  OuttriggerSentiment,
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  ArchivedFrontingSession,
  FrontingComment,
  ArchivedFrontingComment,
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
  ReceivedKeyGrant,
  ReceivedKeyGrantsResponse,
} from "./privacy.js";
export { BUCKET_CONTENT_ENTITY_TYPES, isBucketContentEntityType } from "./privacy.js";

// ── Friend Dashboard ──────────────────────────────────────────────
export type {
  FriendDashboardFrontingSession,
  FriendDashboardMember,
  FriendDashboardCustomFront,
  FriendDashboardStructureEntity,
  FriendDashboardKeyGrant,
  FriendDashboardResponse,
  FriendAccessContext,
  FriendDashboardEntityType,
  FriendDashboardSyncEntry,
  FriendDashboardSyncResponse,
} from "./friend-dashboard.js";

// ── Friend Export ────────────────────────────────────────────────────
export type {
  FriendExportEntityType,
  FriendExportEntity,
  FriendExportPageResponse,
  FriendExportManifestEntry,
  FriendExportManifestResponse,
} from "./friend-export.js";
export { FRIEND_EXPORT_ENTITY_TYPES, isFriendExportEntityType } from "./friend-export.js";

// ── Reports ────────────────────────────────────────────────────────
export type {
  ReportType,
  ExportEntityId,
  MemberByBucketReportConfig,
  MeetOurSystemReportConfig,
  ReportConfig,
  ReportEntitySet,
  MemberByBucketReportData,
  MeetOurSystemReportData,
  ReportData,
  BucketExportManifestEntry,
  BucketExportManifestResponse,
  BucketExportEntity,
  BucketExportPageResponse,
} from "./reports.js";
export { REPORT_TYPES, isReportType } from "./reports.js";

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
  SystemStructureEntityType,
  ArchivedSystemStructureEntityType,
  SystemStructureEntity,
  ArchivedSystemStructureEntity,
  SystemStructureEntityLink,
  SystemStructureEntityMemberLink,
  SystemStructureEntityAssociation,
} from "./structure.js";

// ── Auth ──────────────────────────────────────────────────────
export type {
  AuthKeyType,
  AccountType,
  DeviceTransferStatus,
  PendingAccountId,
  Account,
  AuthKey,
  Session,
  DeviceInfo,
  RecoveryKey,
  LoginCredentials,
  RegistrationInitiateInput,
  RegistrationCommitInput,
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
  ServerSecret,
  ServerMember,
  ClientMember,
  ServerFrontingSession,
  ClientFrontingSession,
  ServerGroup,
  ClientGroup,
  ServerStructureEntityType,
  ClientStructureEntityType,
  ServerStructureEntity,
  ClientStructureEntity,
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
  SyncDocumentType,
  DocumentKeyType,
  SyncIndicatorStatus,
  SyncDocument,
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
  PKEntityMapping,
  PKSyncState,
  PKSyncError,
} from "./pk-bridge.js";

// ── Import/Export ────────────────────────────────────────────────
export type {
  PKProxyTag,
  PKImportMember,
  PKImportGroup,
  PKImportSwitch,
  PKImportPayload,
  ImportFailureKind,
  ImportSourceFormat,
  ImportEntityType,
  ImportCollectionType,
  ImportJobStatus,
  ImportProgress,
  ImportError,
  ImportJob,
  ImportCheckpointSchemaVersion,
  ImportAvatarMode,
  ImportCollectionTotals,
  ImportCheckpointState,
  ImportCheckpointStateV1,
  ImportEntityRef,
  ImportEntityTargetIdMap,
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
export {
  IMPORT_SOURCES,
  IMPORT_JOB_STATUSES,
  IMPORT_ENTITY_TYPES,
  IMPORT_COLLECTION_TYPES,
  IMPORT_AVATAR_MODES,
  IMPORT_CHECKPOINT_SCHEMA_VERSION,
} from "./import-export.js";
export { assertBrandedTargetId, InvalidBrandedIdError } from "./assert-branded.js";

// ── Scope domains ────────────────────────────────────────────
export type { ScopeDomain, ScopeTier, RequiredScope } from "./scope-domains.js";
export { SCOPE_DOMAINS, ALL_API_KEY_SCOPES } from "./scope-domains.js";

// ── API keys ──────────────────────────────────────────────────
export type {
  ApiKeyToken,
  ApiKeyScope,
  MetadataApiKey,
  CryptoApiKey,
  ApiKey,
  ApiKeyWithSecret,
} from "./api-keys.js";
export { API_KEY_TOKEN_PREFIX } from "./api-keys.js";

// ── Jobs ──────────────────────────────────────────────────────
export type {
  BackoffStrategy,
  EmailTemplateName,
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
  WebhookDelivery,
  WebhookEventPayloadMap,
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
  NoteAuthorEntityType,
  Note,
  ArchivedNote,
  PollOption,
  PollKind,
  PollStatus,
  Poll,
  ArchivedPoll,
  PollVote,
  ArchivedPollVote,
  AcknowledgementRequest,
  ArchivedAcknowledgementRequest,
} from "./communication.js";
export { NOTE_AUTHOR_ENTITY_TYPES, POLL_KINDS, POLL_STATUSES } from "./communication.js";

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
  StructureEntityFormationEvent,
  FormChangeEvent,
  NameChangeEvent,
  StructureMoveEvent,
  InnerworldMoveEvent,
  LifecycleEvent,
  LifecycleEventType,
} from "./lifecycle.js";

// ── Custom fields ─────────────────────────────────────────────────
export { FIELD_TYPES } from "./custom-fields.js";
export type {
  FieldType,
  FieldBucketVisibility,
  FieldDefinitionScopeType,
  FieldDefinitionScope,
  FieldDefinition,
  ArchivedFieldDefinition,
  FieldValue,
  FieldValueUnion,
  CreateFieldDefinitionBody,
  UpdateFieldDefinitionBody,
  SetFieldValueBody,
  UpdateFieldValueBody,
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
  CheckInRecordStatus,
} from "./timer.js";

// ── Key Rotation ─────────────────────────────────────────────────
export type {
  RotationState,
  RotationItemStatus,
  BucketKeyRotation,
  BucketRotationItem,
  ChunkClaimResponse,
  ChunkCompletionResponse,
} from "./key-rotation.js";

// ── Analytics ─────────────────────────────────────────────────────
export { DATE_RANGE_PRESETS } from "./analytics.js";
export type {
  Duration,
  DateRangePreset,
  DateRangeFilter,
  FrontingSubjectType,
  MemberFrontingBreakdown,
  SubjectFrontingBreakdown,
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
  StructureEntityEntity,
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
  SnapshotStructureEntityType,
  SnapshotStructureEntity,
  SnapshotRelationship,
  SnapshotGroup,
  SnapshotInnerworldRegion,
  SnapshotInnerworldEntity,
  SnapshotContent,
} from "./snapshot.js";

// ── API constants ─────────────────────────────────────────────────────
export type { RateLimitConfig, RateLimitCategory, ApiErrorCode } from "./api-constants/index.js";
export {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_DAY,
  MS_PER_HOUR,
  RATE_LIMITS,
  API_ERROR_CODES,
  PAGINATION,
  SESSION_TIMEOUTS,
  LAST_ACTIVE_THROTTLE_MS,
  BLOB_SIZE_LIMITS,
  FRIEND_CODE,
  AUDIT_RETENTION,
  CLIENT_RETRY,
  KEY_ROTATION,
  ROTATION_STATES,
  ROTATION_ITEM_STATUSES,
} from "./api-constants/index.js";

// ── Logger ─────────────────────────────────────────────────────────
export type { Logger } from "./logger.js";

// ── Runtime utilities ──────────────────────────────────────────────
export { createId, now, toISO, extractErrorMessage } from "./runtime.js";

// ── Subscription events ────────────────────────────────────────────
export type {
  MessageChangeEvent,
  MessageChangeType,
  BoardMessageChangeEvent,
  BoardMessageChangeType,
  PollChangeEvent,
  PollChangeType,
  AcknowledgementChangeEvent,
  AcknowledgementChangeType,
  EntityChangeEvent,
} from "./subscription-events.js";
