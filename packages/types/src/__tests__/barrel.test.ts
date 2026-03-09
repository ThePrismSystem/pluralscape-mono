import { describe, expectTypeOf, it } from "vitest";

import { createId, ID_PREFIXES, now, toISO } from "../index.js";

import type {
  Account,
  AcknowledgementRequest,
  ActiveFrontingSession,
  ArchivalEvent,
  BoardMessage,
  Channel,
  ChartData,
  ChartDataset,
  ChatMessage,
  CheckInRecord,
  ClientMember,
  DateRangeFilter,
  DateRangePreset,
  DecryptFn,
  DiscoveryEvent,
  Duration,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptFn,
  EncryptionAlgorithm,
  EntityLink,
  FieldBucketVisibility,
  FieldDefinition,
  FieldType,
  FieldValue,
  FieldValueUnion,
  FrontingAnalytics,
  FrontingReport,
  FusionEvent,
  InnerWorldCanvas,
  InnerWorldEntity,
  InnerWorldEntityData,
  InnerWorldRegion,
  JournalBlock,
  JournalBlockType,
  JournalEntry,
  LandmarkEntity,
  LifecycleEvent,
  LifecycleEventType,
  MemberEntity,
  MemberFrontingBreakdown,
  MergeEvent,
  Note,
  Poll,
  PollOption,
  PollVote,
  ServerMember,
  SplitEvent,
  TimerConfig,
  UnmergeEvent,
  VisualProperties,
  WikiPage,
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
  CoFrontState,
  CompletedFrontingSession,
  CreateInput,
  CustomFront,
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
  LoginCredentials,
  Member,
  MemberId,
  MemberPhotoId,
  OpenLayer,
  OriginType,
  PaginatedResult,
  PrivacyBucket,
  RecoveryKey,
  RecoveryKeyId,
  RegistrationInput,
  Relationship,
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
    expectTypeOf<EncryptionAlgorithm>().toBeString();
    expectTypeOf<EncryptedBlob>().toBeObject();
    expectTypeOf<EncryptedString>().toExtend<string>();
    expectTypeOf<ServerMember>().toBeObject();
    expectTypeOf<ClientMember>().toBeObject();
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
    expectTypeOf<EntityLink>().toBeObject();
    expectTypeOf<JournalEntry>().toBeObject();
    expectTypeOf<WikiPage>().toBeObject();
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
    expectTypeOf<ChartDataset>().toBeObject();
    expectTypeOf<ChartData>().toBeObject();
  });

  it("exports innerworld types", () => {
    expectTypeOf<VisualProperties>().toBeObject();
    expectTypeOf<MemberEntity>().toBeObject();
    expectTypeOf<LandmarkEntity>().toBeObject();
    expectTypeOf<InnerWorldEntityData>().toBeObject();
    expectTypeOf<InnerWorldEntity>().toBeObject();
    expectTypeOf<InnerWorldRegion>().toBeObject();
    expectTypeOf<InnerWorldCanvas>().toBeObject();
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
