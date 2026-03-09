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
  AcknowledgementRequest,
  ActiveFrontingSession,
  ApiKey,
  ApiKeyScope,
  ApiKeyToken,
  ApiKeyWithSecret,
  AppLockConfig,
  ArchivalEvent,
  AuditEventType,
  AuditLogEntry,
  BlobDownloadRef,
  BlobMetadata,
  BlobPurpose,
  BlobUploadRequest,
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
  Duration,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptedWebhookPayload,
  EncryptFn,
  EncryptionAlgorithm,
  EntityLink,
  FieldBucketVisibility,
  FieldDefinition,
  FieldType,
  FieldValue,
  FieldValueUnion,
  FrontingAnalytics,
  FrontingChangedEvent,
  FrontingReport,
  FrontingReportId,
  FusionEvent,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
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
  MemberLinkBlock,
  MemberUpdatedEvent,
  MergeEvent,
  MessageReceivedEvent,
  MetadataApiKey,
  Note,
  NotificationConfig,
  NotificationConfigId,
  NotificationEventType,
  NotificationPayload,
  ParagraphBlock,
  Plaintext,
  PlaintextWebhookPayload,
  Poll,
  PollOption,
  PollVote,
  PresenceHeartbeatEvent,
  QuoteBlock,
  RealtimeSubscription,
  RetryPolicy,
  SearchableEntityType,
  SearchIndex,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingSession,
  ServerGroup,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerLifecycleEvent,
  ServerMember,
  ServerNote,
  ServerRelationship,
  ServerSubsystem,
  SplitEvent,
  SSEEvent,
  SubscriptionId,
  SyncStateChangedEvent,
  TimerConfig,
  UnmergeEvent,
  VisualProperties,
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryId,
  WebhookDeliveryPayload,
  WebhookEventType,
  WebSocketConnectionState,
  WebSocketEvent,
  WebSocketEventType,
  WikiPage,
  ArchivedJournalEntry,
  ArchivedWikiPage,
  ClientBoardMessage,
  ClientChannel,
  ClientChatMessage,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientInnerWorldEntity,
  ClientInnerWorldRegion,
  ClientLifecycleEvent,
  ClientNote,
  CodeBlock,
  DividerBlock,
  EntityLinkBlock,
  ApiError,
  ApiResponse,
  ArchivedCustomFront,
  ArchivedGroup,
  ArchitectureType,
  AuditMetadata,
  AuthKey,
  AuthKeyId,
  AuthKeyType,
  Brand,
  BucketAccessCheck,
  BucketContentTag,
  BucketVisibilityScope,
  CanonicalTerm,
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
  FrontingSession,
  FrontingType,
  GatekeptLayer,
  Group,
  GroupMembership,
  GroupMoveOperation,
  GroupTree,
  HexColor,
  ISOTimestamp,
  KeyGrant,
  Layer,
  LayerAccessType,
  LayerMembership,
  LittlesSafeModeConfig,
  Locale,
  LocaleConfig,
  LoginCredentials,
  Member,
  MemberId,
  MemberPhotoId,
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
  SyncConflict,
  SyncConflictId,
  SyncDocument,
  SyncDocumentId,
  SyncIndicator,
  SyncIndicatorStatus,
  SyncOperation,
  SyncQueueItem,
  SyncQueueItemId,
  SyncResolution,
  SyncState,
  SyncPreferences,
  SystemProfile,
  SystemSettings,
  FriendRequestPolicy,
  RelationshipType,
  Result,
  RoleTag,
  Session,
  SideSystem,
  SideSystemMembership,
  SortDirection,
  Subsystem,
  SubsystemMembership,
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
    expectTypeOf<RoleTag>().toBeObject();
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
  });

  it("exports privacy types", () => {
    expectTypeOf<PrivacyBucket>().toBeObject();
    expectTypeOf<BucketContentTag>().toBeObject();
    expectTypeOf<BucketVisibilityScope>().toBeString();
    expectTypeOf<KeyGrant>().toBeObject();
    expectTypeOf<FriendConnectionStatus>().toBeString();
    expectTypeOf<FriendConnection>().toBeObject();
    expectTypeOf<FriendCode>().toBeObject();
    expectTypeOf<BucketAccessCheck>().toBeObject();
  });

  it("exports structure types", () => {
    expectTypeOf<RelationshipType>().toBeString();
    expectTypeOf<Relationship>().toBeObject();
    expectTypeOf<ArchitectureType>().toBeString();
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
    expectTypeOf<DecryptFn<ServerMember, ClientMember>>().toBeFunction();
    expectTypeOf<EncryptFn<ClientMember, ServerMember>>().toBeFunction();
  });

  it("exports sync types", () => {
    expectTypeOf<SyncDocumentId>().toExtend<string>();
    expectTypeOf<SyncQueueItemId>().toExtend<string>();
    expectTypeOf<SyncConflictId>().toExtend<string>();
    expectTypeOf<SyncOperation>().toBeString();
    expectTypeOf<SyncResolution>().toBeString();
    expectTypeOf<SyncIndicatorStatus>().toBeString();
    expectTypeOf<SyncDocument>().toBeObject();
    expectTypeOf<SyncQueueItem>().toBeObject();
    expectTypeOf<SyncConflict>().toBeObject();
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
    expectTypeOf<BlobMetadata>().toBeObject();
    expectTypeOf<BlobUploadRequest>().toBeObject();
    expectTypeOf<BlobDownloadRef>().toBeObject();
  });

  it("exports audit log types", () => {
    expectTypeOf<AuditEventType>().toBeString();
    expectTypeOf<AuditLogEntry>().toBeObject();
  });

  it("exports webhook types", () => {
    expectTypeOf<WebhookDeliveryId>().toExtend<string>();
    expectTypeOf<WebhookEventType>().toBeString();
    expectTypeOf<WebhookConfig>().toBeObject();
    expectTypeOf<PlaintextWebhookPayload>().toBeObject();
    expectTypeOf<EncryptedWebhookPayload>().toBeObject();
    expectTypeOf<WebhookDeliveryPayload>().toBeObject();
    expectTypeOf<WebhookDelivery>().toBeObject();
  });

  it("exports notification types", () => {
    expectTypeOf<DeviceToken>().toBeObject();
    expectTypeOf<NotificationEventType>().toBeString();
    expectTypeOf<NotificationConfig>().toBeObject();
    expectTypeOf<NotificationPayload>().toBeObject();
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
    expectTypeOf<CheckInRecord>().toBeObject();
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
  });

  it("exports innerworld types", () => {
    expectTypeOf<VisualProperties>().toBeObject();
    expectTypeOf<MemberEntity>().toBeObject();
    expectTypeOf<LandmarkEntity>().toBeObject();
    expectTypeOf<InnerWorldEntity>().toBeObject();
    expectTypeOf<InnerWorldRegion>().toBeObject();
    expectTypeOf<InnerWorldCanvas>().toBeObject();
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

    type AE = ApiError;
    expectTypeOf<AE>().toBeObject();
  });

  it("exports ID_PREFIXES runtime value", () => {
    expectTypeOf(ID_PREFIXES).toBeObject();
    expectTypeOf(ID_PREFIXES.system).toEqualTypeOf<"sys_">();
  });

  it("exports runtime utilities", () => {
    expectTypeOf(createId).toBeFunction();
    expectTypeOf(now).toBeFunction();
    expectTypeOf(toISO).toBeFunction();
    expectTypeOf(now()).toEqualTypeOf<UnixMillis>();
    expectTypeOf(toISO(now())).toEqualTypeOf<ISOTimestamp>();
  });
});
