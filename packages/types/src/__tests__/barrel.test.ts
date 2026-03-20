import { describe, expectTypeOf, it } from "vitest";

import {
  createDefaultNomenclatureSettings,
  createId,
  DEFAULT_TERM_PRESETS,
  ID_PREFIXES,
  now,
  toISO,
} from "../index.js";

import type {
  Account,
  AccountPurgeRequest,
  AccountPurgeRequestId,
  AccountPurgeStatus,
  AcknowledgementRequest,
  ActiveFrontingSession,
  ApiKey,
  ApiKeyScope,
  ApiKeyToken,
  ApiKeyWithSecret,
  AppLockConfig,
  ArchivalEvent,
  AuditActor,
  AuditEventType,
  AuditLogEntry,
  ArchivedBlobMetadata,
  BlobDownloadRef,
  BlobMetadata,
  BlobPurpose,
  BlobUploadRequest,
  EncryptionTier,
  BoardMessage,
  BucketEncrypted,
  BucketId,
  Channel,
  ChartData,
  ChartDataset,
  ChatMessage,
  CheckInRecord,
  ClientFrontingSession,
  ClientGroup,
  ClientMember,
  ClientRelationship,
  ClientSubsystem,
  ConnectionErrorEvent,
  CryptoApiKey,
  DateRangeFilter,
  DateRangePreset,
  DecryptFn,
  DeviceToken,
  DeviceTokenId,
  DiscoveryEvent,
  DownloadableReport,
  Duration,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptedWebhookPayload,
  EncryptFn,
  EncryptionAlgorithm,
  EntityLink,
  ExportFormat,
  ExportManifest,
  ExportSection,
  FieldBucketVisibility,
  FieldDefinition,
  FieldType,
  FieldValue,
  FieldValueUnion,
  FormChangeEvent,
  FrontingAnalytics,
  FrontingChangedEvent,
  FrontingReport,
  FrontingReportId,
  FusionEvent,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
  ImportEntityType,
  ImportError,
  ImportJob,
  ImportJobId,
  ImportJobStatus,
  ImportProgress,
  ImportSource,
  InnerWorldCanvas,
  InnerWorldEntity,
  InnerWorldRegion,
  JobDefinition,
  JobId,
  JobResult,
  JobStatus,
  JobType,
  JournalBlock,
  JournalBlockType,
  JournalEntry,
  LandmarkEntity,
  LifecycleEvent,
  LifecycleEventType,
  ListBlock,
  MemberEntity,
  MemberFrontingBreakdown,
  MemberListItem,
  MemberLinkBlock,
  MemberReport,
  SystemOverviewReport,
  MemberUpdatedEvent,
  MergeEvent,
  MessageReceivedEvent,
  MetadataApiKey,
  Note,
  NotificationConfig,
  ArchivedNotificationConfig,
  NotificationConfigId,
  NotificationEventType,
  NotificationPayload,
  ParagraphBlock,
  PKBridgeConfig,
  PKBridgeConfigId,
  PKEntityMapping,
  PKGroupMapping,
  PKImportGroup,
  PKImportMember,
  PKImportPayload,
  PKImportSwitch,
  PKMemberMapping,
  PKProxyTag,
  PKSwitchMapping,
  PKSyncableEntityType,
  PKSyncDirection,
  PKSyncError,
  PKSyncErrorCode,
  PKSyncState,
  PKSyncStatus,
  Plaintext,
  PlaintextWebhookPayload,
  Poll,
  PollKind,
  PollOption,
  PollVote,
  PresenceHeartbeatEvent,
  QuoteBlock,
  RealtimeSubscription,
  ReportFormat,
  RetryPolicy,
  SearchableEntityType,
  SearchIndex,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  ServerAcknowledgementRequest,
  ServerAuditLogEntry,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerCustomFront,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingSession,
  ServerGroup,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerJournalEntry,
  ServerLayer,
  ServerLifecycleEvent,
  SPImportBoardMessage,
  SPImportChatMessage,
  SPImportCustomField,
  SPImportCustomFieldValue,
  SPImportFriend,
  SPImportFrontingSession,
  SPImportGroup,
  SPImportMember,
  SPImportNote,
  SPImportPayload,
  SPImportPoll,
  SPImportPrivacyBucket,
  SPImportTimer,
  ServerMember,
  ServerMemberPhoto,
  ServerNote,
  ServerPoll,
  ServerRelationship,
  ServerSideSystem,
  ServerSubsystem,
  ServerTimerConfig,
  ServerWikiPage,
  SplitEvent,
  SSEEvent,
  SubscriptionId,
  SyncStateChangedEvent,
  TimerConfig,
  ArchivedTimerConfig,
  ArchivedCheckInRecord,
  UnmergeEvent,
  VisualProperties,
  WebhookConfig,
  ArchivedWebhookConfig,
  WebhookDelivery,
  ArchivedWebhookDelivery,
  WebhookDeliveryId,
  WebhookDeliveryPayload,
  WebhookEventType,
  WebSocketConnectionState,
  WebSocketEvent,
  WebSocketEventType,
  WikiPage,
  ArchivedJournalEntry,
  ArchivedWikiPage,
  ClientAcknowledgementRequest,
  ClientAuditLogEntry,
  ClientBoardMessage,
  ClientChannel,
  ClientChatMessage,
  ClientCustomFront,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientInnerWorldEntity,
  ClientInnerWorldRegion,
  ClientJournalEntry,
  ClientLayer,
  ClientLifecycleEvent,
  ClientMemberPhoto,
  ClientNote,
  ClientPoll,
  ClientSideSystem,
  ClientTimerConfig,
  ClientWikiPage,
  CodeBlock,
  DividerBlock,
  EntityLinkBlock,
  ActionResult,
  ApiError,
  ApiResponse,
  ArchivedCustomFront,
  ArchivedFriendCode,
  ArchivedFriendConnection,
  ArchivedGroup,
  ArchivedInnerWorldEntity,
  ArchivedInnerWorldRegion,
  ArchivedMember,
  ArchivedMemberPhoto,
  ArchivedPrivacyBucket,
  ArchitectureType,
  KnownArchitectureType,
  StructureVisualProps,
  AuditMetadata,
  AuthKey,
  AuthKeyId,
  AuthKeyType,
  Brand,
  BucketAccessCheck,
  BucketContentTag,
  BucketVisibilityScope,
  CanonicalTerm,
  CoFrontingAnalytics,
  CoFrontingPair,
  CoFrontState,
  CompletedFrontingSession,
  CreateInput,
  CustomFront,
  DateFormatPreference,
  DateRange,
  DeepReadonly,
  DeviceInfo,
  DeviceTransferPayload,
  DeviceTransferRequest,
  DeviceTransferRequestId,
  DeviceTransferStatus,
  DiscoveryStatus,
  EntityReference,
  EntityType,
  FriendCode,
  FriendConnection,
  FriendConnectionStatus,
  FriendNotificationEventType,
  FriendNotificationPreference,
  ArchivedFriendNotificationPreference,
  FriendNotificationPreferenceId,
  FriendVisibilitySettings,
  FrontingComment,
  FrontingCommentId,
  FrontingSession,
  FrontingType,
  GatekeptLayer,
  Group,
  GroupMembership,
  GroupMoveOperation,
  GroupTree,
  HexColor,
  ImageSource,
  ISOTimestamp,
  KeyGrant,
  KnownSaturationLevel,
  KnownTag,
  Layer,
  LayerAccessType,
  LayerEntity,
  LayerMembership,
  LittlesSafeModeConfig,
  Locale,
  LocaleConfig,
  LoginCredentials,
  Member,
  MemberId,
  MemberPhotoId,
  NameChangeEvent,
  NomenclatureSettings,
  NotificationPreferences,
  NumberFormatPreference,
  OpenLayer,
  OriginType,
  PaginatedResult,
  PrivacyBucket,
  PrivacyDefaults,
  RecoveryKey,
  RecoveryKeyId,
  RegistrationInput,
  Relationship,
  SafeModeContentItem,
  SafeModeUIFlags,
  SyncChangeId,
  SyncDocument,
  SyncDocumentId,
  SyncDocumentType,
  SyncIndicator,
  SyncIndicatorStatus,
  DocumentKeyType,
  SyncSnapshotId,
  SyncState,
  SyncPreferences,
  SystemProfile,
  SystemSettings,
  FriendRequestPolicy,
  RelationshipType,
  Result,
  Tag,
  SaturationLevel,
  ServerFrontingComment,
  ClientFrontingComment,
  ServerPollVote,
  ClientPollVote,
  Session,
  SideSystem,
  SideSystemEntity,
  SideSystemLayerLink,
  SideSystemMembership,
  SortDirection,
  Subsystem,
  SubsystemEntity,
  SubsystemFormationEvent,
  SubsystemLayerLink,
  SubsystemMembership,
  SubsystemSideSystemLink,
  Switch,
  SwitchId,
  System,
  SystemId,
  TermCategory,
  TermPreset,
  TextDirection,
  ThemePreference,
  TranslationKey,
  TranslationMap,
  UnixMillis,
  UpdateInput,
  ValidationError,
} from "../index.js";

describe("barrel exports", () => {
  it("exports all key types", () => {
    expectTypeOf<Brand<string, "test">>().toExtend<string>();
    expectTypeOf<SystemId>().toExtend<string>();
    expectTypeOf<MemberId>().toExtend<string>();
    expectTypeOf<MemberPhotoId>().toExtend<string>();
    expectTypeOf<SwitchId>().toExtend<string>();
    expectTypeOf<HexColor>().toExtend<string>();
    expectTypeOf<EntityType>().toExtend<string>();
    expectTypeOf<System>().toBeObject();
    expectTypeOf<Member>().toBeObject();
    expectTypeOf<ArchivedMember>().toBeObject();
    expectTypeOf<ArchivedMemberPhoto>().toBeObject();
    expectTypeOf<MemberListItem>().toBeObject();
    expectTypeOf<ImageSource>().toBeObject();
    expectTypeOf<KnownSaturationLevel>().toBeString();
    expectTypeOf<SaturationLevel>().toBeObject();
    expectTypeOf<KnownTag>().toBeString();
    expectTypeOf<Tag>().toBeObject();
    expectTypeOf<SortDirection>().toBeString();
    expectTypeOf<AuditMetadata>().toBeObject();
    expectTypeOf<EntityReference>().toBeObject();
    expectTypeOf<DateRange>().toBeObject();
    expectTypeOf<ValidationError>().toBeObject();
  });

  it("exports fronting types", () => {
    expectTypeOf<FrontingType>().toBeString();
    expectTypeOf<FrontingSession>().toBeObject();
    expectTypeOf<ActiveFrontingSession>().toBeObject();
    expectTypeOf<CompletedFrontingSession>().toBeObject();
    expectTypeOf<Switch>().toBeObject();
    expectTypeOf<CustomFront>().toBeObject();
    expectTypeOf<ArchivedCustomFront>().toBeObject();
    expectTypeOf<CoFrontState>().toBeObject();
    expectTypeOf<FrontingComment>().toBeObject();
    expectTypeOf<FrontingCommentId>().toExtend<string>();
  });

  it("exports privacy types", () => {
    expectTypeOf<PrivacyBucket>().toBeObject();
    expectTypeOf<ArchivedPrivacyBucket>().toBeObject();
    expectTypeOf<BucketContentTag>().toBeObject();
    expectTypeOf<BucketVisibilityScope>().toBeString();
    expectTypeOf<KeyGrant>().toBeObject();
    expectTypeOf<FriendConnectionStatus>().toBeString();
    expectTypeOf<FriendConnection>().toBeObject();
    expectTypeOf<ArchivedFriendConnection>().toBeObject();
    expectTypeOf<FriendCode>().toBeObject();
    expectTypeOf<ArchivedFriendCode>().toBeObject();
    expectTypeOf<BucketAccessCheck>().toBeObject();
    expectTypeOf<FriendVisibilitySettings>().toBeObject();
  });

  it("exports structure types", () => {
    expectTypeOf<RelationshipType>().toBeString();
    expectTypeOf<Relationship>().toBeObject();
    expectTypeOf<ArchitectureType>().toBeObject();
    expectTypeOf<KnownArchitectureType>().toBeString();
    expectTypeOf<StructureVisualProps>().toBeObject();
    expectTypeOf<OriginType>().toBeString();
    expectTypeOf<DiscoveryStatus>().toBeString();
    expectTypeOf<LayerAccessType>().toBeString();
    expectTypeOf<Subsystem>().toBeObject();
    expectTypeOf<SideSystem>().toBeObject();
    expectTypeOf<Layer>().toBeObject();
    expectTypeOf<OpenLayer>().toBeObject();
    expectTypeOf<GatekeptLayer>().toBeObject();
    expectTypeOf<SubsystemMembership>().toBeObject();
    expectTypeOf<SideSystemMembership>().toBeObject();
    expectTypeOf<LayerMembership>().toBeObject();
    expectTypeOf<SubsystemLayerLink>().toBeObject();
    expectTypeOf<SubsystemSideSystemLink>().toBeObject();
    expectTypeOf<SideSystemLayerLink>().toBeObject();
  });

  it("exports auth types", () => {
    expectTypeOf<AuthKeyId>().toExtend<string>();
    expectTypeOf<RecoveryKeyId>().toExtend<string>();
    expectTypeOf<DeviceTransferRequestId>().toExtend<string>();
    expectTypeOf<AuthKeyType>().toBeString();
    expectTypeOf<DeviceTransferStatus>().toBeString();
    expectTypeOf<Account>().toBeObject();
    expectTypeOf<AuthKey>().toBeObject();
    expectTypeOf<Session>().toBeObject();
    expectTypeOf<DeviceInfo>().toBeObject();
    expectTypeOf<RecoveryKey>().toBeObject();
    expectTypeOf<LoginCredentials>().toBeObject();
    expectTypeOf<RegistrationInput>().toBeObject();
    expectTypeOf<DeviceTransferRequest>().toBeObject();
    expectTypeOf<DeviceTransferPayload>().toBeObject();
  });

  it("exports encryption types", () => {
    expectTypeOf<Encrypted<string>>().toExtend<string>();
    expectTypeOf<BucketEncrypted<string>>().toExtend<string>();
    expectTypeOf<Plaintext<string>>().toExtend<string>();
    expectTypeOf<EncryptionAlgorithm>().toBeString();
    expectTypeOf<EncryptedBlob>().toBeObject();
    expectTypeOf<EncryptedString>().toExtend<string>();
    expectTypeOf<ServerMember>().toBeObject();
    expectTypeOf<ClientMember>().toBeObject();
    expectTypeOf<ServerFrontingSession>().toBeObject();
    expectTypeOf<ClientFrontingSession>().toBeObject();
    expectTypeOf<ServerGroup>().toBeObject();
    expectTypeOf<ClientGroup>().toBeObject();
    expectTypeOf<ServerSubsystem>().toBeObject();
    expectTypeOf<ClientSubsystem>().toBeObject();
    expectTypeOf<ServerRelationship>().toBeObject();
    expectTypeOf<ClientRelationship>().toBeObject();
    expectTypeOf<ServerChannel>().toBeObject();
    expectTypeOf<ClientChannel>().toBeObject();
    expectTypeOf<ServerChatMessage>().toBeObject();
    expectTypeOf<ClientChatMessage>().toBeObject();
    expectTypeOf<ServerBoardMessage>().toBeObject();
    expectTypeOf<ClientBoardMessage>().toBeObject();
    expectTypeOf<ServerNote>().toBeObject();
    expectTypeOf<ClientNote>().toBeObject();
    expectTypeOf<ServerFieldDefinition>().toBeObject();
    expectTypeOf<ClientFieldDefinition>().toBeObject();
    expectTypeOf<ServerFieldValue>().toBeObject();
    expectTypeOf<ClientFieldValue>().toBeObject();
    expectTypeOf<ServerInnerWorldEntity>().toBeObject();
    expectTypeOf<ClientInnerWorldEntity>().toBeObject();
    expectTypeOf<ServerInnerWorldRegion>().toBeObject();
    expectTypeOf<ClientInnerWorldRegion>().toBeObject();
    expectTypeOf<ServerLifecycleEvent>().toBeObject();
    expectTypeOf<ClientLifecycleEvent>().toBeObject();
    expectTypeOf<ServerCustomFront>().toBeObject();
    expectTypeOf<ClientCustomFront>().toBeObject();
    expectTypeOf<ServerJournalEntry>().toBeObject();
    expectTypeOf<ClientJournalEntry>().toBeObject();
    expectTypeOf<ServerWikiPage>().toBeObject();
    expectTypeOf<ClientWikiPage>().toBeObject();
    expectTypeOf<ServerMemberPhoto>().toBeObject();
    expectTypeOf<ClientMemberPhoto>().toBeObject();
    expectTypeOf<ServerPoll>().toBeObject();
    expectTypeOf<ClientPoll>().toBeObject();
    expectTypeOf<ServerAcknowledgementRequest>().toBeObject();
    expectTypeOf<ClientAcknowledgementRequest>().toBeObject();
    expectTypeOf<ServerSideSystem>().toBeObject();
    expectTypeOf<ClientSideSystem>().toBeObject();
    expectTypeOf<ServerLayer>().toBeObject();
    expectTypeOf<ClientLayer>().toBeObject();
    expectTypeOf<ServerTimerConfig>().toBeObject();
    expectTypeOf<ClientTimerConfig>().toBeObject();
    expectTypeOf<ServerAuditLogEntry>().toBeObject();
    expectTypeOf<ClientAuditLogEntry>().toBeObject();
    expectTypeOf<ClientJournalEntry>().toBeObject();
    expectTypeOf<ClientWikiPage>().toBeObject();
    expectTypeOf<ClientMemberPhoto>().toBeObject();
    expectTypeOf<ClientPoll>().toBeObject();
    expectTypeOf<ClientAcknowledgementRequest>().toBeObject();
    expectTypeOf<ClientSideSystem>().toBeObject();
    expectTypeOf<ClientLayer>().toBeObject();
    expectTypeOf<ClientTimerConfig>().toBeObject();
    expectTypeOf<ClientAuditLogEntry>().toBeObject();
    expectTypeOf<ServerFrontingComment>().toBeObject();
    expectTypeOf<ClientFrontingComment>().toBeObject();
    expectTypeOf<ServerPollVote>().toBeObject();
    expectTypeOf<ClientPollVote>().toBeObject();
    expectTypeOf<DecryptFn<ServerMember, ClientMember>>().toBeFunction();
    expectTypeOf<EncryptFn<ClientMember, ServerMember>>().toBeFunction();
  });

  it("exports sync types", () => {
    expectTypeOf<SyncChangeId>().toExtend<string>();
    expectTypeOf<SyncDocumentId>().toExtend<string>();
    expectTypeOf<SyncSnapshotId>().toExtend<string>();
    expectTypeOf<SyncDocumentType>().toBeString();
    expectTypeOf<DocumentKeyType>().toBeString();
    expectTypeOf<SyncIndicatorStatus>().toBeString();
    expectTypeOf<SyncDocument>().toBeObject();
    expectTypeOf<SyncState>().toBeObject();
    expectTypeOf<SyncIndicator>().toBeObject();
  });

  it("exports group types", () => {
    expectTypeOf<Group>().toBeObject();
    expectTypeOf<ArchivedGroup>().toBeObject();
    expectTypeOf<GroupMembership>().toBeObject();
    expectTypeOf<GroupTree>().toBeObject();
    expectTypeOf<GroupMoveOperation>().toBeObject();
  });

  it("exports api key types", () => {
    expectTypeOf<ApiKeyToken>().toExtend<string>();
    expectTypeOf<ApiKeyScope>().toBeString();
    expectTypeOf<MetadataApiKey>().toBeObject();
    expectTypeOf<CryptoApiKey>().toBeObject();
    expectTypeOf<ApiKey>().toBeObject();
    expectTypeOf<ApiKeyWithSecret>().toBeObject();
  });

  it("exports infrastructure ID types", () => {
    expectTypeOf<DeviceTokenId>().toExtend<string>();
    expectTypeOf<NotificationConfigId>().toExtend<string>();
    expectTypeOf<JobId>().toExtend<string>();
    expectTypeOf<SubscriptionId>().toExtend<string>();
    expectTypeOf<WebhookDeliveryId>().toExtend<string>();
  });

  it("exports job types", () => {
    expectTypeOf<JobType>().toBeString();
    expectTypeOf<JobStatus>().toBeString();
    expectTypeOf<RetryPolicy>().toBeObject();
    expectTypeOf<JobResult>().toBeObject();
    expectTypeOf<JobDefinition>().toBeObject();
  });

  it("exports blob types", () => {
    expectTypeOf<BlobPurpose>().toBeString();
    expectTypeOf<EncryptionTier>().toBeNumber();
    expectTypeOf<BlobMetadata>().toBeObject();
    expectTypeOf<ArchivedBlobMetadata>().toBeObject();
    expectTypeOf<BlobUploadRequest>().toBeObject();
    expectTypeOf<BlobDownloadRef>().toBeObject();
  });

  it("exports audit log types", () => {
    expectTypeOf<AuditActor>().toBeObject();
    expectTypeOf<AuditEventType>().toBeString();
    expectTypeOf<AuditLogEntry>().toBeObject();
  });

  it("exports webhook types", () => {
    expectTypeOf<WebhookDeliveryId>().toExtend<string>();
    expectTypeOf<WebhookEventType>().toBeString();
    expectTypeOf<WebhookConfig>().toBeObject();
    expectTypeOf<ArchivedWebhookConfig>().toBeObject();
    expectTypeOf<PlaintextWebhookPayload>().toBeObject();
    expectTypeOf<EncryptedWebhookPayload>().toBeObject();
    expectTypeOf<WebhookDeliveryPayload>().toBeObject();
    expectTypeOf<WebhookDelivery>().toBeObject();
    expectTypeOf<ArchivedWebhookDelivery>().toBeObject();
  });

  it("exports notification types", () => {
    expectTypeOf<DeviceToken>().toBeObject();
    expectTypeOf<NotificationEventType>().toBeString();
    expectTypeOf<NotificationConfig>().toBeObject();
    expectTypeOf<ArchivedNotificationConfig>().toBeObject();
    expectTypeOf<NotificationPayload>().toBeObject();
    expectTypeOf<FriendNotificationEventType>().toBeString();
    expectTypeOf<FriendNotificationPreference>().toBeObject();
    expectTypeOf<ArchivedFriendNotificationPreference>().toBeObject();
    expectTypeOf<FriendNotificationPreferenceId>().toExtend<string>();
  });

  it("exports realtime types", () => {
    expectTypeOf<FrontingChangedEvent>().toBeObject();
    expectTypeOf<MemberUpdatedEvent>().toBeObject();
    expectTypeOf<SyncStateChangedEvent>().toBeObject();
    expectTypeOf<MessageReceivedEvent>().toBeObject();
    expectTypeOf<PresenceHeartbeatEvent>().toBeObject();
    expectTypeOf<ConnectionErrorEvent>().toBeObject();
    expectTypeOf<WebSocketEvent>().toBeObject();
    expectTypeOf<WebSocketEventType>().toBeString();
    expectTypeOf<SSEEvent>().toBeObject();
    expectTypeOf<RealtimeSubscription>().toBeObject();
    expectTypeOf<WebSocketConnectionState>().toBeString();
  });

  it("exports search types", () => {
    expectTypeOf<SearchIndex>().toExtend<string>();
    expectTypeOf<SearchableEntityType>().toBeString();
    expectTypeOf<SearchQuery>().toBeObject();
    expectTypeOf<SearchResultItem<string>>().toBeObject();
    expectTypeOf<SearchResult<string>>().toBeObject();
  });

  it("exports communication types", () => {
    expectTypeOf<Channel>().toBeObject();
    expectTypeOf<ChatMessage>().toBeObject();
    expectTypeOf<BoardMessage>().toBeObject();
    expectTypeOf<Note>().toBeObject();
    expectTypeOf<PollOption>().toBeObject();
    expectTypeOf<Poll>().toBeObject();
    expectTypeOf<PollKind>().toBeString();
    expectTypeOf<PollVote>().toBeObject();
    expectTypeOf<AcknowledgementRequest>().toBeObject();
  });

  it("exports lifecycle types", () => {
    expectTypeOf<SplitEvent>().toBeObject();
    expectTypeOf<FusionEvent>().toBeObject();
    expectTypeOf<MergeEvent>().toBeObject();
    expectTypeOf<UnmergeEvent>().toBeObject();
    expectTypeOf<DiscoveryEvent>().toBeObject();
    expectTypeOf<ArchivalEvent>().toBeObject();
    expectTypeOf<LifecycleEvent>().toBeObject();
    expectTypeOf<LifecycleEventType>().toBeString();
    expectTypeOf<SubsystemFormationEvent>().toBeObject();
    expectTypeOf<FormChangeEvent>().toBeObject();
    expectTypeOf<NameChangeEvent>().toBeObject();
  });

  it("exports custom field types", () => {
    expectTypeOf<FieldType>().toBeString();
    expectTypeOf<FieldBucketVisibility>().toBeObject();
    expectTypeOf<FieldDefinition>().toBeObject();
    expectTypeOf<FieldValue>().toBeObject();
    expectTypeOf<FieldValueUnion>().toBeObject();
  });

  it("exports journal types", () => {
    expectTypeOf<JournalBlockType>().toBeString();
    expectTypeOf<JournalBlock>().toBeObject();
    expectTypeOf<ParagraphBlock>().toBeObject();
    expectTypeOf<HeadingBlock>().toBeObject();
    expectTypeOf<HeadingLevel>().toBeNumber();
    expectTypeOf<ListBlock>().toBeObject();
    expectTypeOf<QuoteBlock>().toBeObject();
    expectTypeOf<CodeBlock>().toBeObject();
    expectTypeOf<ImageBlock>().toBeObject();
    expectTypeOf<DividerBlock>().toBeObject();
    expectTypeOf<MemberLinkBlock>().toBeObject();
    expectTypeOf<EntityLinkBlock>().toBeObject();
    expectTypeOf<EntityLink>().toBeObject();
    expectTypeOf<JournalEntry>().toBeObject();
    expectTypeOf<ArchivedJournalEntry>().toBeObject();
    expectTypeOf<WikiPage>().toBeObject();
    expectTypeOf<ArchivedWikiPage>().toBeObject();
  });

  it("exports timer types", () => {
    expectTypeOf<TimerConfig>().toBeObject();
    expectTypeOf<ArchivedTimerConfig>().toBeObject();
    expectTypeOf<CheckInRecord>().toBeObject();
    expectTypeOf<ArchivedCheckInRecord>().toBeObject();
  });

  it("exports analytics types", () => {
    expectTypeOf<Duration>().toExtend<number>();
    expectTypeOf<DateRangePreset>().toBeString();
    expectTypeOf<DateRangeFilter>().toBeObject();
    expectTypeOf<MemberFrontingBreakdown>().toBeObject();
    expectTypeOf<FrontingAnalytics>().toBeObject();
    expectTypeOf<FrontingReport>().toBeObject();
    expectTypeOf<FrontingReportId>().toExtend<string>();
    expectTypeOf<ChartDataset>().toBeObject();
    expectTypeOf<ChartData>().toBeObject();
    expectTypeOf<CoFrontingPair>().toBeObject();
    expectTypeOf<CoFrontingAnalytics>().toBeObject();
  });

  it("exports innerworld types", () => {
    expectTypeOf<VisualProperties>().toBeObject();
    expectTypeOf<MemberEntity>().toBeObject();
    expectTypeOf<LandmarkEntity>().toBeObject();
    expectTypeOf<InnerWorldEntity>().toBeObject();
    expectTypeOf<ArchivedInnerWorldEntity>().toBeObject();
    expectTypeOf<InnerWorldRegion>().toBeObject();
    expectTypeOf<ArchivedInnerWorldRegion>().toBeObject();
    expectTypeOf<InnerWorldCanvas>().toBeObject();
    expectTypeOf<SubsystemEntity>().toBeObject();
    expectTypeOf<SideSystemEntity>().toBeObject();
    expectTypeOf<LayerEntity>().toBeObject();
  });

  it("exports structure profile types", () => {
    expectTypeOf<SystemProfile>().toBeObject();
  });

  it("exports littles safe mode types", () => {
    expectTypeOf<SafeModeUIFlags>().toBeObject();
    expectTypeOf<SafeModeContentItem>().toBeObject();
    expectTypeOf<LittlesSafeModeConfig>().toBeObject();
  });

  it("exports nomenclature types and runtime values", () => {
    expectTypeOf<TermCategory>().toBeString();
    expectTypeOf<CanonicalTerm>().toBeObject();
    expectTypeOf<NomenclatureSettings>().toBeObject();
    expectTypeOf<TermPreset>().toBeObject();
    expectTypeOf(DEFAULT_TERM_PRESETS).toExtend<readonly TermPreset[]>();
    expectTypeOf(createDefaultNomenclatureSettings).toBeFunction();
  });

  it("exports i18n types", () => {
    expectTypeOf<Locale>().toExtend<string>();
    expectTypeOf<TranslationKey>().toExtend<string>();
    expectTypeOf<TranslationMap>().toBeObject();
    expectTypeOf<TextDirection>().toBeString();
    expectTypeOf<DateFormatPreference>().toBeString();
    expectTypeOf<NumberFormatPreference>().toBeString();
    expectTypeOf<LocaleConfig>().toBeObject();
  });

  it("exports settings types", () => {
    expectTypeOf<ThemePreference>().toBeString();
    expectTypeOf<AppLockConfig>().toBeObject();
    expectTypeOf<NotificationPreferences>().toBeObject();
    expectTypeOf<SyncPreferences>().toBeObject();
    expectTypeOf<FriendRequestPolicy>().toBeString();
    expectTypeOf<PrivacyDefaults>().toBeObject();
    expectTypeOf<SystemSettings>().toBeObject();
    expectTypeOf<SystemSettings["fontScale"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemSettings["defaultBucketId"]>().toEqualTypeOf<BucketId | null>();
  });

  it("exports generic utility types", () => {
    type CI = CreateInput<{ id: string; name: string }>;
    expectTypeOf<CI>().toHaveProperty("name");

    type UI = UpdateInput<{ id: string; name: string }>;
    expectTypeOf<UI>().toBeObject();

    type DR = DeepReadonly<{ a: string }>;
    expectTypeOf<DR>().toBeObject();

    type PR = PaginatedResult<string>;
    expectTypeOf<PR>().toBeObject();

    type R = Result<string, Error>;
    expectTypeOf<R>().toBeObject();

    type AR = ApiResponse<string>;
    expectTypeOf<AR>().toBeObject();

    type ACR = ActionResult;
    expectTypeOf<ACR>().toBeObject();

    type AE = ApiError;
    expectTypeOf<AE>().toBeObject();
  });

  it("exports ID_PREFIXES runtime value", () => {
    expectTypeOf(ID_PREFIXES).toBeObject();
    expectTypeOf(ID_PREFIXES.system).toEqualTypeOf<"sys_">();
  });

  it("exports PK bridge types", () => {
    expectTypeOf<PKSyncDirection>().toBeString();
    expectTypeOf<PKSyncStatus>().toBeString();
    expectTypeOf<PKSyncableEntityType>().toBeString();
    expectTypeOf<PKSyncErrorCode>().toBeString();
    expectTypeOf<PKBridgeConfigId>().toExtend<string>();
    expectTypeOf<PKBridgeConfig>().toBeObject();
    expectTypeOf<PKMemberMapping>().toBeObject();
    expectTypeOf<PKGroupMapping>().toBeObject();
    expectTypeOf<PKSwitchMapping>().toBeObject();
    expectTypeOf<PKEntityMapping>().toBeObject();
    expectTypeOf<PKSyncState>().toBeObject();
    expectTypeOf<PKSyncError>().toBeObject();
  });

  it("exports import/export types", () => {
    expectTypeOf<SPImportMember>().toBeObject();
    expectTypeOf<SPImportGroup>().toBeObject();
    expectTypeOf<SPImportFrontingSession>().toBeObject();
    expectTypeOf<SPImportCustomField>().toBeObject();
    expectTypeOf<SPImportCustomFieldValue>().toBeObject();
    expectTypeOf<SPImportNote>().toBeObject();
    expectTypeOf<SPImportChatMessage>().toBeObject();
    expectTypeOf<SPImportBoardMessage>().toBeObject();
    expectTypeOf<SPImportPoll>().toBeObject();
    expectTypeOf<SPImportTimer>().toBeObject();
    expectTypeOf<SPImportPrivacyBucket>().toBeObject();
    expectTypeOf<SPImportFriend>().toBeObject();
    expectTypeOf<SPImportPayload>().toBeObject();
    expectTypeOf<PKProxyTag>().toBeObject();
    expectTypeOf<PKImportMember>().toBeObject();
    expectTypeOf<PKImportGroup>().toBeObject();
    expectTypeOf<PKImportSwitch>().toBeObject();
    expectTypeOf<PKImportPayload>().toBeObject();
    expectTypeOf<ImportSource>().toBeString();
    expectTypeOf<ImportEntityType>().toBeString();
    expectTypeOf<ImportJobId>().toExtend<string>();
    expectTypeOf<ImportJobStatus>().toBeString();
    expectTypeOf<ImportProgress>().toBeObject();
    expectTypeOf<ImportError>().toBeObject();
    expectTypeOf<ImportJob>().toBeObject();
    expectTypeOf<ExportFormat>().toBeString();
    expectTypeOf<ExportSection>().toBeString();
    expectTypeOf<DownloadableReport>().toBeObject();
    expectTypeOf<ExportManifest>().toBeObject();
    expectTypeOf<AccountPurgeRequestId>().toExtend<string>();
    expectTypeOf<AccountPurgeStatus>().toBeString();
    expectTypeOf<ReportFormat>().toBeString();
    expectTypeOf<AccountPurgeRequest>().toBeObject();
    expectTypeOf<MemberReport>().toBeObject();
    expectTypeOf<SystemOverviewReport>().toBeObject();
  });

  it("exports runtime utilities", () => {
    expectTypeOf(createId).toBeFunction();
    expectTypeOf(now).toBeFunction();
    expectTypeOf(toISO).toBeFunction();
    expectTypeOf(now()).toEqualTypeOf<UnixMillis>();
    expectTypeOf(toISO(now())).toEqualTypeOf<ISOTimestamp>();
  });
});
