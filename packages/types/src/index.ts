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

// ── Type-level assertions (SoT parity) ──────────────────────────────
export type { Assert, Equal, Extends, Serialize } from "./type-assertions.js";

// ── SoT manifest ────────────────────────────────────────────────────
export type { SotEntityManifest } from "./__sot-manifest__.js";

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
  Member,
  KnownSaturationLevel,
  SaturationLevel,
  KnownTag,
  Tag,
  ArchivedMember,
  MemberListItem,
  CreateMemberBody,
  UpdateMemberBody,
  DuplicateMemberBody,
} from "./entities/member.js";
export type {
  MemberPhoto,
  ArchivedMemberPhoto,
  CreateMemberPhotoBody,
} from "./entities/member-photo.js";
export type { System, SystemListItem } from "./entities/system.js";

// ── Fronting ────────────────────────────────────────────────────────
export type {
  OuttriggerSentiment,
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  ArchivedFrontingSession,
  CoFrontState,
} from "./entities/fronting-session.js";
export type { FrontingComment, ArchivedFrontingComment } from "./entities/fronting-comment.js";
export type { CustomFront, ArchivedCustomFront } from "./entities/custom-front.js";

// ── Privacy ────────────────────────────────────────────────────────
export type {
  PrivacyBucket,
  ArchivedPrivacyBucket,
  BucketContentEntityType,
  BucketContentTag,
  BucketVisibilityScope,
  BucketAccessCheck,
} from "./entities/bucket.js";
export { BUCKET_CONTENT_ENTITY_TYPES, isBucketContentEntityType } from "./entities/bucket.js";
export type {
  FriendConnectionStatus,
  FriendVisibilitySettings,
  FriendConnection,
  ArchivedFriendConnection,
  FriendBucketAssignment,
} from "./entities/friend-connection.js";
export type { FriendCode, ArchivedFriendCode } from "./entities/friend-code.js";
export type {
  KeyGrant,
  ReceivedKeyGrant,
  ReceivedKeyGrantsResponse,
} from "./entities/key-grant.js";

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
} from "./entities/relationship.js";
export type {
  KnownArchitectureType,
  ArchitectureType,
  SystemStructureEntityType,
  ArchivedSystemStructureEntityType,
} from "./entities/structure-entity-type.js";
export type {
  StructureVisualProps,
  OriginType,
  DiscoveryStatus,
  SystemProfile,
  SystemStructureEntity,
  ArchivedSystemStructureEntity,
} from "./entities/structure-entity.js";
export type { SystemStructureEntityLink } from "./entities/structure-entity-link.js";
export type { SystemStructureEntityMemberLink } from "./entities/structure-entity-member-link.js";
export type { SystemStructureEntityAssociation } from "./entities/structure-entity-association.js";

// ── Auth ──────────────────────────────────────────────────────
export type {
  Account,
  AccountType,
  LoginCredentials,
  PendingAccountId,
  RegistrationCommitInput,
  RegistrationInitiateInput,
} from "./entities/account.js";
export type { AuthKey, AuthKeyType } from "./entities/auth-key.js";
export type {
  DeviceTransferPayload,
  DeviceTransferRequest,
  DeviceTransferStatus,
} from "./entities/device-transfer-request.js";
export type { RecoveryKey } from "./entities/recovery-key.js";
export type { DeviceInfo, Session } from "./entities/session.js";

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
  MemberServerMetadata,
  MemberWire,
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
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
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
  ImportCheckpointStateV2,
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
  JobPayload,
  JobCommonFields,
  RetryPolicy,
  JobResult,
  JobDefinition,
} from "./jobs.js";
export { JOB_TYPE_VALUES, JOB_STATUS_VALUES } from "./jobs.js";

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
  WebhookEventType,
  WebhookConfig,
  ArchivedWebhookConfig,
  WebhookEventPayloadMap,
} from "./entities/webhook-config.js";
export type { WebhookDeliveryStatus, WebhookDelivery } from "./entities/webhook-delivery.js";

// ── Notifications ─────────────────────────────────────────────
export type { DeviceTokenPlatform, DeviceToken } from "./entities/device-token.js";
export type {
  NotificationEventType,
  NotificationConfig,
  ArchivedNotificationConfig,
  NotificationPayload,
} from "./entities/notification-config.js";
export type {
  FriendNotificationEventType,
  FriendNotificationPreference,
  ArchivedFriendNotificationPreference,
} from "./entities/friend-notification-preference.js";

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
  AcknowledgementRequest,
  ArchivedAcknowledgementRequest,
} from "./entities/acknowledgement.js";
export type { BoardMessage, ArchivedBoardMessage } from "./entities/board-message.js";
export type { Channel, ArchivedChannel } from "./entities/channel.js";
export type { ChatMessage, ArchivedChatMessage } from "./entities/message.js";
export type { Note, ArchivedNote, NoteAuthorEntityType } from "./entities/note.js";
export { NOTE_AUTHOR_ENTITY_TYPES } from "./entities/note.js";
export type { PollVote, ArchivedPollVote } from "./entities/poll-vote.js";
export type { Poll, ArchivedPoll, PollOption, PollKind, PollStatus } from "./entities/poll.js";
export { POLL_KINDS, POLL_STATUSES } from "./entities/poll.js";

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
} from "./entities/lifecycle-event.js";

// ── Custom fields ─────────────────────────────────────────────────
export { FIELD_TYPES } from "./entities/field-definition.js";
export type {
  FieldType,
  FieldBucketVisibility,
  FieldDefinition,
  ArchivedFieldDefinition,
  CreateFieldDefinitionBody,
  UpdateFieldDefinitionBody,
} from "./entities/field-definition.js";
export type {
  FieldDefinitionScopeType,
  FieldDefinitionScope,
} from "./entities/field-definition-scope.js";
export type {
  FieldValue,
  FieldValueUnion,
  SetFieldValueBody,
  UpdateFieldValueBody,
} from "./entities/field-value.js";

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
export type { TimerConfig, ArchivedTimerConfig } from "./entities/timer-config.js";
export type {
  CheckInRecord,
  ArchivedCheckInRecord,
  CheckInRecordStatus,
} from "./entities/check-in-record.js";

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
export { DATE_RANGE_PRESETS, toDuration } from "./analytics.js";
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
} from "./entities/innerworld-entity.js";
export type { InnerWorldRegion, ArchivedInnerWorldRegion } from "./entities/innerworld-region.js";
export type { InnerWorldCanvas } from "./entities/innerworld-canvas.js";

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
export { SUPPORTED_LOCALES } from "./i18n.js";
export {
  I18N_CACHE_TTL_MS,
  I18N_OTA_TIMEOUT_MS,
  I18N_ETAG_LENGTH,
  asEtag,
  type Etag,
  type I18nManifest,
  type I18nLocaleManifest,
  type I18nNamespaceManifest,
  type I18nNamespace,
  type I18nNamespaceWithEtag,
} from "./i18n/index.js";

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
