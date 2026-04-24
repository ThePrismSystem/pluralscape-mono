// @pluralscape/types — shared TypeScript domain types

// ── Domain entities ──────────────────────────────────────────────
// Full inventory in ./entities/index.ts. New entities add a file there
// and a line in its barrel; no edits needed here.
export * from "./entities/index.js";

// ── Type-level assertions (SoT parity) ───────────────────────────
export type { Assert, Equal, Extends, Serialize } from "./type-assertions.js";

// ── SoT manifest ─────────────────────────────────────────────────
export type { SotEntityManifest } from "./__sot-manifest__.js";

// ── Crypto key brands ────────────────────────────────────────────
export type { KdfMasterKey } from "./crypto-keys.js";

// ── IDs ──────────────────────────────────────────────────────────
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
  AnyBrandedId,
} from "./ids.js";
export { ID_PREFIXES } from "./ids.js";

// ── Brand utilities ──────────────────────────────────────────────
export { brandId } from "./brand-utils.js";
export { assertBrandedTargetId, InvalidBrandedIdError } from "./assert-branded.js";

// ── Checksum ─────────────────────────────────────────────────────
export { toChecksumHex } from "./checksum.js";

// ── Encryption primitives ────────────────────────────────────────
// Server*/Client* wrappers for non-pilot entities live alongside the
// primitives until Plan 2 renames each to <Entity>ServerMetadata per
// entity file. MemberServerMetadata/MemberWire and AuditLogEntry*
// already live in their entity files.
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
  DecryptFn,
  EncryptFn,
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
  ServerPollVote,
  ClientPollVote,
  ServerAcknowledgementRequest,
  ClientAcknowledgementRequest,
  ServerTimerConfig,
  ClientTimerConfig,
} from "./encryption-primitives.js";

// ── Response unions ──────────────────────────────────────────────
export type { ServerResponseData, ClientResponseData } from "./response-unions.js";

// Member{ServerMetadata,Wire} and AuditLogEntry{ServerMetadata,Wire}
// are re-exported through the entities/ barrel.

// ── Timestamps ───────────────────────────────────────────────────
export type { UnixMillis, ISOTimestamp } from "./timestamps.js";
export { toUnixMillis, toUnixMillisOrNull } from "./timestamps.js";

// ── Pagination ───────────────────────────────────────────────────
export type { PaginationCursor, PaginatedResult, OffsetPaginationParams } from "./pagination.js";
export { CursorInvalidError } from "./pagination.js";

// ── Results ──────────────────────────────────────────────────────
export type {
  Result,
  ApiError,
  ApiErrorResponse,
  ApiResponse,
  ValidationError,
} from "./results.js";

// ── Utility types ────────────────────────────────────────────────
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

// ── Image source ─────────────────────────────────────────────────
export type { ImageSource } from "./image-source.js";

// ── Server-safe enforcement ──────────────────────────────────────
export type { ServerSafe } from "./server-safe.js";
export { serverSafe } from "./server-safe.js";

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

// ── Scope domains ────────────────────────────────────────────────
export type { ScopeDomain, ScopeTier, RequiredScope } from "./scope-domains.js";
export { SCOPE_DOMAINS, ALL_API_KEY_SCOPES } from "./scope-domains.js";

// ── Jobs ─────────────────────────────────────────────────────────
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

// ── Realtime ─────────────────────────────────────────────────────
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

// ── Subscription events ──────────────────────────────────────────
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

// ── Search ───────────────────────────────────────────────────────
export type {
  SearchIndex,
  SearchableEntityType,
  SearchQuery,
  SearchResultItem,
  SearchResult,
} from "./search.js";

// ── Analytics ────────────────────────────────────────────────────
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

// ── Friend Dashboard ─────────────────────────────────────────────
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

// ── Friend Export ────────────────────────────────────────────────
export type {
  FriendExportEntityType,
  FriendExportEntity,
  FriendExportPageResponse,
  FriendExportManifestEntry,
  FriendExportManifestResponse,
} from "./friend-export.js";
export { FRIEND_EXPORT_ENTITY_TYPES, isFriendExportEntityType } from "./friend-export.js";

// ── Reports ──────────────────────────────────────────────────────
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

// ── Littles Safe Mode ────────────────────────────────────────────
export type {
  SafeModeUIFlags,
  SafeModeContentItem,
  LittlesSafeModeConfig,
} from "./littles-safe-mode.js";

// ── Nomenclature ─────────────────────────────────────────────────
export type {
  TermCategory,
  CanonicalTerm,
  NomenclatureSettings,
  NomenclatureEncryptedFields,
  NomenclatureServerMetadata,
  NomenclatureWire,
  TermPreset,
} from "./nomenclature.js";
export { DEFAULT_TERM_PRESETS, createDefaultNomenclatureSettings } from "./nomenclature.js";

// ── i18n ─────────────────────────────────────────────────────────
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

// ── API constants ────────────────────────────────────────────────
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

// ── Logger ───────────────────────────────────────────────────────
export type { Logger } from "./logger.js";

// ── Runtime utilities ────────────────────────────────────────────
export { createId, now, toISO, extractErrorMessage } from "./runtime.js";
