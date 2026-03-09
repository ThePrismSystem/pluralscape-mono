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
  JobId,
  SubscriptionId,
  WebhookDeliveryId,
  FrontingReportId,
  FriendNotificationPreferenceId,
  FrontingCommentId,
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
  MemberListItem,
} from "./identity.js";

// ── Fronting ────────────────────────────────────────────────────────
export type {
  FrontingType,
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  FrontingComment,
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
  FriendVisibilitySettings,
  FriendConnection,
  FriendCode,
  BucketAccessCheck,
} from "./privacy.js";

// ── Structure ──────────────────────────────────────────────────────
export type {
  RelationshipType,
  Relationship,
  KnownArchitectureType,
  ArchitectureType,
  StructureVisualProps,
  OriginType,
  DiscoveryStatus,
  SystemProfile,
  LayerAccessType,
  Subsystem,
  SideSystem,
  Layer,
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
export type { JobType, JobStatus, RetryPolicy, JobResult, JobDefinition } from "./jobs.js";

// ── Blob ──────────────────────────────────────────────────────
export type { BlobPurpose, BlobMetadata, BlobUploadRequest, BlobDownloadRef } from "./blob.js";

// ── Audit log ─────────────────────────────────────────────────
export type { AuditEventType, AuditActor, AuditLogEntry } from "./audit-log.js";

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
  FriendNotificationEventType,
  FriendNotificationPreference,
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
  ChatMessage,
  BoardMessage,
  Note,
  PollOption,
  PollKind,
  Poll,
  PollVote,
  AcknowledgementRequest,
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
  LifecycleEvent,
  LifecycleEventType,
} from "./lifecycle.js";

// ── Custom fields ─────────────────────────────────────────────────
export type {
  FieldType,
  FieldBucketVisibility,
  FieldDefinition,
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
  JournalEntry,
  ArchivedJournalEntry,
  WikiPage,
  ArchivedWikiPage,
} from "./journal.js";

// ── Timer ─────────────────────────────────────────────────────────
export type { TimerConfig, CheckInRecord } from "./timer.js";

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
  InnerWorldRegion,
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

// ── Runtime utilities ──────────────────────────────────────────────
export { createId, now, toISO } from "./runtime.js";
