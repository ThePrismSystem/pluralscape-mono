import type {
  FrontingReport,
  FrontingReportEncryptedFields,
  FrontingReportEncryptedInput,
  FrontingReportResult,
  FrontingReportServerMetadata,
  FrontingReportWire,
} from "./analytics.js";
import type {
  AccountPurgeRequest,
  AccountPurgeRequestServerMetadata,
  AccountPurgeRequestWire,
} from "./entities/account-purge-request.js";
import type { Account, AccountServerMetadata, AccountWire } from "./entities/account.js";
import type {
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedFields,
  AcknowledgementRequestEncryptedInput,
  AcknowledgementRequestResult,
  AcknowledgementRequestServerMetadata,
  AcknowledgementRequestWire,
} from "./entities/acknowledgement.js";
import type {
  ApiKey,
  ApiKeyEncryptedPayload,
  ApiKeyServerMetadata,
  ApiKeyWire,
} from "./entities/api-key.js";
import type {
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "./entities/audit-log-entry.js";
import type { AuthKey, AuthKeyServerMetadata, AuthKeyWire } from "./entities/auth-key.js";
import type {
  BlobMetadata,
  BlobMetadataServerMetadata,
  BlobMetadataWire,
} from "./entities/blob.js";
import type {
  BoardMessage,
  BoardMessageEncryptedFields,
  BoardMessageEncryptedInput,
  BoardMessageResult,
  BoardMessageServerMetadata,
  BoardMessageWire,
} from "./entities/board-message.js";
import type {
  BucketKeyRotation,
  BucketKeyRotationServerMetadata,
  BucketKeyRotationWire,
} from "./entities/bucket-key-rotation.js";
import type {
  BucketRotationItem,
  BucketRotationItemServerMetadata,
  BucketRotationItemWire,
} from "./entities/bucket-rotation-item.js";
import type {
  PrivacyBucket,
  PrivacyBucketEncryptedFields,
  PrivacyBucketEncryptedInput,
  PrivacyBucketResult,
  PrivacyBucketServerMetadata,
  PrivacyBucketWire,
} from "./entities/bucket.js";
import type {
  Channel,
  ChannelEncryptedFields,
  ChannelEncryptedInput,
  ChannelResult,
  ChannelServerMetadata,
  ChannelWire,
} from "./entities/channel.js";
import type {
  CheckInRecord,
  CheckInRecordResult,
  CheckInRecordServerMetadata,
  CheckInRecordWire,
} from "./entities/check-in-record.js";
import type {
  CustomFront,
  CustomFrontEncryptedFields,
  CustomFrontEncryptedInput,
  CustomFrontResult,
  CustomFrontServerMetadata,
  CustomFrontWire,
} from "./entities/custom-front.js";
import type {
  DeviceToken,
  DeviceTokenServerMetadata,
  DeviceTokenWire,
} from "./entities/device-token.js";
import type {
  DeviceTransferRequest,
  DeviceTransferRequestServerMetadata,
  DeviceTransferRequestWire,
} from "./entities/device-transfer-request.js";
import type {
  ExportRequest,
  ExportRequestServerMetadata,
  ExportRequestWire,
} from "./entities/export-request.js";
import type {
  FieldDefinitionScope,
  FieldDefinitionScopeServerMetadata,
  FieldDefinitionScopeWire,
} from "./entities/field-definition-scope.js";
import type {
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldDefinitionEncryptedInput,
  FieldDefinitionResult,
  FieldDefinitionServerMetadata,
  FieldDefinitionWire,
} from "./entities/field-definition.js";
import type {
  FieldValue,
  FieldValueEncryptedFields,
  FieldValueEncryptedInput,
  FieldValueResult,
  FieldValueServerMetadata,
  FieldValueWire,
} from "./entities/field-value.js";
import type {
  FriendCode,
  FriendCodeServerMetadata,
  FriendCodeWire,
} from "./entities/friend-code.js";
import type {
  FriendConnection,
  FriendConnectionEncryptedFields,
  FriendConnectionEncryptedInput,
  FriendConnectionResult,
  FriendConnectionServerMetadata,
  FriendConnectionWire,
} from "./entities/friend-connection.js";
import type {
  FriendNotificationPreference,
  FriendNotificationPreferenceServerMetadata,
  FriendNotificationPreferenceWire,
} from "./entities/friend-notification-preference.js";
import type {
  FrontingComment,
  FrontingCommentEncryptedFields,
  FrontingCommentEncryptedInput,
  FrontingCommentResult,
  FrontingCommentServerMetadata,
  FrontingCommentWire,
} from "./entities/fronting-comment.js";
import type {
  FrontingSession,
  FrontingSessionEncryptedFields,
  FrontingSessionEncryptedInput,
  FrontingSessionResult,
  FrontingSessionServerMetadata,
  FrontingSessionWire,
} from "./entities/fronting-session.js";
import type {
  Group,
  GroupEncryptedFields,
  GroupEncryptedInput,
  GroupResult,
  GroupServerMetadata,
  GroupWire,
} from "./entities/group.js";
import type { ImportJob, ImportJobServerMetadata, ImportJobWire } from "./entities/import-job.js";
import type {
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedFields,
  InnerWorldCanvasEncryptedInput,
  InnerWorldCanvasResult,
  InnerWorldCanvasServerMetadata,
  InnerWorldCanvasWire,
} from "./entities/innerworld-canvas.js";
import type {
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields,
  InnerWorldEntityEncryptedInput,
  InnerWorldEntityResult,
  InnerWorldEntityServerMetadata,
  InnerWorldEntityWire,
} from "./entities/innerworld-entity.js";
import type {
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields,
  InnerWorldRegionEncryptedInput,
  InnerWorldRegionResult,
  InnerWorldRegionServerMetadata,
  InnerWorldRegionWire,
} from "./entities/innerworld-region.js";
import type {
  JournalEntry,
  JournalEntryEncryptedFields,
  JournalEntryEncryptedInput,
  JournalEntryResult,
  JournalEntryServerMetadata,
  JournalEntryWire,
} from "./entities/journal-entry.js";
import type { KeyGrant, KeyGrantServerMetadata, KeyGrantWire } from "./entities/key-grant.js";
import type {
  LifecycleEvent,
  LifecycleEventEncryptedFields,
  LifecycleEventEncryptedInput,
  LifecycleEventResult,
  LifecycleEventServerMetadata,
  LifecycleEventWire,
} from "./entities/lifecycle-event.js";
import type {
  MemberPhoto,
  MemberPhotoEncryptedFields,
  MemberPhotoEncryptedInput,
  MemberPhotoResult,
  MemberPhotoServerMetadata,
  MemberPhotoWire,
} from "./entities/member-photo.js";
import type {
  Member,
  MemberEncryptedFields,
  MemberEncryptedInput,
  MemberResult,
  MemberServerMetadata,
  MemberWire,
} from "./entities/member.js";
import type {
  ChatMessage,
  ChatMessageEncryptedFields,
  ChatMessageEncryptedInput,
  ChatMessageResult,
  ChatMessageServerMetadata,
  ChatMessageWire,
} from "./entities/message.js";
import type {
  Note,
  NoteEncryptedFields,
  NoteEncryptedInput,
  NoteResult,
  NoteServerMetadata,
  NoteWire,
} from "./entities/note.js";
import type {
  NotificationConfig,
  NotificationConfigServerMetadata,
  NotificationConfigWire,
} from "./entities/notification-config.js";
import type {
  PollVote,
  PollVoteEncryptedFields,
  PollVoteEncryptedInput,
  PollVoteResult,
  PollVoteServerMetadata,
  PollVoteWire,
} from "./entities/poll-vote.js";
import type {
  Poll,
  PollEncryptedFields,
  PollEncryptedInput,
  PollResult,
  PollServerMetadata,
  PollWire,
} from "./entities/poll.js";
import type {
  RecoveryKey,
  RecoveryKeyServerMetadata,
  RecoveryKeyWire,
} from "./entities/recovery-key.js";
import type {
  Relationship,
  RelationshipEncryptedFields,
  RelationshipEncryptedInput,
  RelationshipResult,
  RelationshipServerMetadata,
  RelationshipWire,
} from "./entities/relationship.js";
import type {
  DeviceInfo,
  Session,
  SessionServerMetadata,
  SessionWire,
} from "./entities/session.js";
import type {
  SystemStructureEntityAssociation,
  SystemStructureEntityAssociationEncryptedFields,
  SystemStructureEntityAssociationServerMetadata,
  SystemStructureEntityAssociationWire,
} from "./entities/structure-entity-association.js";
import type {
  SystemStructureEntityLink,
  SystemStructureEntityLinkServerMetadata,
  SystemStructureEntityLinkWire,
} from "./entities/structure-entity-link.js";
import type {
  SystemStructureEntityMemberLink,
  SystemStructureEntityMemberLinkEncryptedFields,
  SystemStructureEntityMemberLinkServerMetadata,
  SystemStructureEntityMemberLinkWire,
} from "./entities/structure-entity-member-link.js";
import type {
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
  SystemStructureEntityTypeEncryptedInput,
  SystemStructureEntityTypeResult,
  SystemStructureEntityTypeServerMetadata,
  SystemStructureEntityTypeWire,
} from "./entities/structure-entity-type.js";
import type {
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields,
  SystemStructureEntityEncryptedInput,
  SystemStructureEntityResult,
  SystemStructureEntityServerMetadata,
  SystemStructureEntityWire,
} from "./entities/structure-entity.js";
import type {
  SyncDocument,
  SyncDocumentServerMetadata,
  SyncDocumentWire,
} from "./entities/sync-document.js";
import type {
  SystemSettings,
  SystemSettingsEncryptedFields,
  SystemSettingsEncryptedInput,
  SystemSettingsResult,
  SystemSettingsServerMetadata,
  SystemSettingsWire,
} from "./entities/system-settings.js";
import type {
  SnapshotContent,
  SystemSnapshot,
  SystemSnapshotServerMetadata,
  SystemSnapshotWire,
} from "./entities/system-snapshot.js";
import type {
  System,
  SystemEncryptedFields,
  SystemEncryptedInput,
  SystemResult,
  SystemServerMetadata,
  SystemWire,
} from "./entities/system.js";
import type {
  TimerConfig,
  TimerConfigEncryptedFields,
  TimerConfigEncryptedInput,
  TimerConfigResult,
  TimerConfigServerMetadata,
  TimerConfigWire,
} from "./entities/timer-config.js";
import type {
  WebhookConfig,
  WebhookConfigServerMetadata,
  WebhookConfigWire,
} from "./entities/webhook-config.js";
import type {
  WebhookDelivery,
  WebhookDeliveryServerMetadata,
  WebhookDeliveryWire,
} from "./entities/webhook-delivery.js";
import type {
  WikiPage,
  WikiPageEncryptedFields,
  WikiPageEncryptedInput,
  WikiPageResult,
  WikiPageServerMetadata,
  WikiPageWire,
} from "./entities/wiki-page.js";
import type {
  NomenclatureEncryptedFields,
  NomenclatureServerMetadata,
  NomenclatureSettings,
  NomenclatureWire,
} from "./nomenclature.js";

/**
 * Registry of every domain entity that participates in the types-as-SoT
 * parity gates. Each entry carries the canonical chain:
 *
 * - `domain`         — the full decrypted domain shape (`<Entity>`)
 * - `encryptedFields`— keys-union of encrypted fields (or `never` for
 *                      plaintext / hybrid entities with no keys-subset union)
 * - `encryptedInput` — for Class A entities (`encryptedFields` is a real
 *                      keys-union), this is `Pick<<Entity>, <Entity>EncryptedFields>`.
 *                      For Class C entities (`encryptedFields: never` plus a
 *                      divergent encrypted payload), this is the auxiliary
 *                      type carried inside the blob (see ADR-023). Omitted
 *                      for plaintext entities with no encrypted blob.
 * - `server`         — the server-visible Drizzle row shape
 *                      (`<Entity>ServerMetadata`)
 * - `result`         — `EncryptedWire<<Entity>ServerMetadata>` (server's
 *                      JS-runtime response shape, before JSON serialization).
 *                      Omitted for entities with no encrypted-blob result type.
 * - `wire`           — the JSON-serialized HTTP shape (`<Entity>Wire`)
 *
 * Completeness checks in `packages/db` and `packages/validation` assert that
 * every Drizzle table and every Zod schema maps to a manifest entry, so
 * silently dropping an entity during fleet work fails CI.
 */
export type SotEntityManifest = {
  Member: {
    domain: Member;
    encryptedFields: MemberEncryptedFields;
    encryptedInput: MemberEncryptedInput;
    server: MemberServerMetadata;
    result: MemberResult;
    wire: MemberWire;
  };
  AuditLogEntry: {
    domain: AuditLogEntry;
    server: AuditLogEntryServerMetadata;
    wire: AuditLogEntryWire;
    // Plaintext wire — no encrypted fields.
    encryptedFields: never;
  };
  Account: {
    domain: Account;
    server: AccountServerMetadata;
    wire: AccountWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  BlobMetadata: {
    domain: BlobMetadata;
    server: BlobMetadataServerMetadata;
    wire: BlobMetadataWire;
    // Plaintext entity — no encrypted fields. The blob contents are
    // encrypted, but the metadata row itself is server-visible.
    encryptedFields: never;
  };
  System: {
    domain: System;
    encryptedFields: SystemEncryptedFields;
    encryptedInput: SystemEncryptedInput;
    server: SystemServerMetadata;
    result: SystemResult;
    wire: SystemWire;
  };
  MemberPhoto: {
    domain: MemberPhoto;
    encryptedFields: MemberPhotoEncryptedFields;
    encryptedInput: MemberPhotoEncryptedInput;
    server: MemberPhotoServerMetadata;
    result: MemberPhotoResult;
    wire: MemberPhotoWire;
  };
  Group: {
    domain: Group;
    encryptedFields: GroupEncryptedFields;
    encryptedInput: GroupEncryptedInput;
    server: GroupServerMetadata;
    result: GroupResult;
    wire: GroupWire;
  };
  CustomFront: {
    domain: CustomFront;
    encryptedFields: CustomFrontEncryptedFields;
    encryptedInput: CustomFrontEncryptedInput;
    server: CustomFrontServerMetadata;
    result: CustomFrontResult;
    wire: CustomFrontWire;
  };
  FieldDefinition: {
    domain: FieldDefinition;
    encryptedFields: FieldDefinitionEncryptedFields;
    encryptedInput: FieldDefinitionEncryptedInput;
    server: FieldDefinitionServerMetadata;
    result: FieldDefinitionResult;
    wire: FieldDefinitionWire;
  };
  FieldDefinitionScope: {
    domain: FieldDefinitionScope;
    server: FieldDefinitionScopeServerMetadata;
    wire: FieldDefinitionScopeWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  FieldValue: {
    domain: FieldValue;
    encryptedFields: FieldValueEncryptedFields;
    encryptedInput: FieldValueEncryptedInput;
    server: FieldValueServerMetadata;
    result: FieldValueResult;
    wire: FieldValueWire;
  };
  Relationship: {
    domain: Relationship;
    encryptedFields: RelationshipEncryptedFields;
    encryptedInput: RelationshipEncryptedInput;
    server: RelationshipServerMetadata;
    result: RelationshipResult;
    wire: RelationshipWire;
  };
  StructureEntityType: {
    domain: SystemStructureEntityType;
    encryptedFields: SystemStructureEntityTypeEncryptedFields;
    encryptedInput: SystemStructureEntityTypeEncryptedInput;
    server: SystemStructureEntityTypeServerMetadata;
    result: SystemStructureEntityTypeResult;
    wire: SystemStructureEntityTypeWire;
  };
  StructureEntity: {
    domain: SystemStructureEntity;
    encryptedFields: SystemStructureEntityEncryptedFields;
    encryptedInput: SystemStructureEntityEncryptedInput;
    server: SystemStructureEntityServerMetadata;
    result: SystemStructureEntityResult;
    wire: SystemStructureEntityWire;
  };
  FrontingSession: {
    domain: FrontingSession;
    encryptedFields: FrontingSessionEncryptedFields;
    encryptedInput: FrontingSessionEncryptedInput;
    server: FrontingSessionServerMetadata;
    result: FrontingSessionResult;
    wire: FrontingSessionWire;
  };
  FrontingComment: {
    domain: FrontingComment;
    encryptedFields: FrontingCommentEncryptedFields;
    encryptedInput: FrontingCommentEncryptedInput;
    server: FrontingCommentServerMetadata;
    result: FrontingCommentResult;
    wire: FrontingCommentWire;
  };
  LifecycleEvent: {
    domain: LifecycleEvent;
    encryptedFields: LifecycleEventEncryptedFields;
    encryptedInput: LifecycleEventEncryptedInput;
    server: LifecycleEventServerMetadata;
    result: LifecycleEventResult;
    wire: LifecycleEventWire;
  };
  InnerworldRegion: {
    domain: InnerWorldRegion;
    encryptedFields: InnerWorldRegionEncryptedFields;
    encryptedInput: InnerWorldRegionEncryptedInput;
    server: InnerWorldRegionServerMetadata;
    result: InnerWorldRegionResult;
    wire: InnerWorldRegionWire;
  };
  InnerworldEntity: {
    domain: InnerWorldEntity;
    encryptedFields: InnerWorldEntityEncryptedFields;
    encryptedInput: InnerWorldEntityEncryptedInput;
    server: InnerWorldEntityServerMetadata;
    result: InnerWorldEntityResult;
    wire: InnerWorldEntityWire;
  };
  InnerworldCanvas: {
    domain: InnerWorldCanvas;
    encryptedFields: InnerWorldCanvasEncryptedFields;
    encryptedInput: InnerWorldCanvasEncryptedInput;
    server: InnerWorldCanvasServerMetadata;
    result: InnerWorldCanvasResult;
    wire: InnerWorldCanvasWire;
  };
  SystemSettings: {
    domain: SystemSettings;
    encryptedFields: SystemSettingsEncryptedFields;
    encryptedInput: SystemSettingsEncryptedInput;
    server: SystemSettingsServerMetadata;
    result: SystemSettingsResult;
    wire: SystemSettingsWire;
  };
  SystemSnapshot: {
    domain: SystemSnapshot;
    encryptedFields: never;
    encryptedInput: SnapshotContent;
    server: SystemSnapshotServerMetadata;
    wire: SystemSnapshotWire;
    // Class C entity per ADR-023: the encrypted blob carries the auxiliary
    // type `SnapshotContent` (members, structure entities, relationships,
    // groups, innerworld snapshot — point-in-time view-only data). Clients
    // decrypt locally to render the snapshot.
  };
  StructureEntityMemberLink: {
    domain: SystemStructureEntityMemberLink;
    server: SystemStructureEntityMemberLinkServerMetadata;
    wire: SystemStructureEntityMemberLinkWire;
    // Domain has no encrypted-fields keys subset (the union resolves to
    // `never`); link rows are plaintext apart from server metadata.
    encryptedFields: SystemStructureEntityMemberLinkEncryptedFields;
  };
  StructureEntityAssociation: {
    domain: SystemStructureEntityAssociation;
    server: SystemStructureEntityAssociationServerMetadata;
    wire: SystemStructureEntityAssociationWire;
    // Domain has no encrypted-fields keys subset (the union resolves to
    // `never`); associations are plaintext apart from server metadata.
    encryptedFields: SystemStructureEntityAssociationEncryptedFields;
  };
  ApiKey: {
    domain: ApiKey;
    encryptedFields: never;
    encryptedInput: ApiKeyEncryptedPayload;
    server: ApiKeyServerMetadata;
    wire: ApiKeyWire;
    // Class C entity per ADR-023: the encrypted blob carries the auxiliary
    // type `ApiKeyEncryptedPayload` (discriminated over keyType: metadata
    // carries `name`; crypto adds `publicKey`). The wire shape strips both
    // the encrypted blob and the Class E `encryptedKeyMaterial` column —
    // see ApiKeyWire JSDoc.
  };
  AuthKey: {
    domain: AuthKey;
    server: AuthKeyServerMetadata;
    wire: AuthKeyWire;
    encryptedFields: never;
  };
  DeviceToken: {
    domain: DeviceToken;
    server: DeviceTokenServerMetadata;
    wire: DeviceTokenWire;
    encryptedFields: never;
  };
  RecoveryKey: {
    domain: RecoveryKey;
    server: RecoveryKeyServerMetadata;
    wire: RecoveryKeyWire;
    encryptedFields: never;
  };
  AccountPurgeRequest: {
    domain: AccountPurgeRequest;
    server: AccountPurgeRequestServerMetadata;
    wire: AccountPurgeRequestWire;
    encryptedFields: never;
  };
  DeviceTransferRequest: {
    domain: DeviceTransferRequest;
    server: DeviceTransferRequestServerMetadata;
    wire: DeviceTransferRequestWire;
    encryptedFields: never;
  };
  Session: {
    domain: Session;
    encryptedFields: never;
    encryptedInput: DeviceInfo;
    server: SessionServerMetadata;
    wire: SessionWire;
    // Class C entity per ADR-023: the encrypted blob carries the auxiliary
    // type `DeviceInfo` (platform/appVersion/deviceName). The domain
    // `Session` exposes only session-lifecycle metadata — clients
    // decrypt `DeviceInfo` locally.
  };
  StructureEntityLink: {
    domain: SystemStructureEntityLink;
    server: SystemStructureEntityLinkServerMetadata;
    wire: SystemStructureEntityLinkWire;
    // Plaintext entity — no client-side encryption; never needed.
    encryptedFields: never;
  };
  Nomenclature: {
    domain: NomenclatureSettings;
    server: NomenclatureServerMetadata;
    wire: NomenclatureWire;
    encryptedFields: NomenclatureEncryptedFields;
  };
  CheckInRecord: {
    domain: CheckInRecord;
    server: CheckInRecordServerMetadata;
    result: CheckInRecordResult;
    wire: CheckInRecordWire;
    // Hybrid entity: plaintext domain with an optional `encryptedData`
    // blob and a `ServerInternal<…>` `idempotencyKey`. No per-field
    // encrypted-keys subset, so `encryptedFields` is `never`.
    encryptedFields: never;
  };
  // ── Cluster 8: Communication + engagement ─────────────────────────────
  Channel: {
    domain: Channel;
    encryptedFields: ChannelEncryptedFields;
    encryptedInput: ChannelEncryptedInput;
    server: ChannelServerMetadata;
    result: ChannelResult;
    wire: ChannelWire;
  };
  ChatMessage: {
    domain: ChatMessage;
    encryptedFields: ChatMessageEncryptedFields;
    encryptedInput: ChatMessageEncryptedInput;
    server: ChatMessageServerMetadata;
    result: ChatMessageResult;
    wire: ChatMessageWire;
  };
  Note: {
    domain: Note;
    encryptedFields: NoteEncryptedFields;
    encryptedInput: NoteEncryptedInput;
    server: NoteServerMetadata;
    result: NoteResult;
    wire: NoteWire;
  };
  BoardMessage: {
    domain: BoardMessage;
    encryptedFields: BoardMessageEncryptedFields;
    encryptedInput: BoardMessageEncryptedInput;
    server: BoardMessageServerMetadata;
    result: BoardMessageResult;
    wire: BoardMessageWire;
  };
  Poll: {
    domain: Poll;
    encryptedFields: PollEncryptedFields;
    encryptedInput: PollEncryptedInput;
    server: PollServerMetadata;
    result: PollResult;
    wire: PollWire;
  };
  PollVote: {
    domain: PollVote;
    encryptedFields: PollVoteEncryptedFields;
    encryptedInput: PollVoteEncryptedInput;
    server: PollVoteServerMetadata;
    result: PollVoteResult;
    wire: PollVoteWire;
  };
  AcknowledgementRequest: {
    domain: AcknowledgementRequest;
    encryptedFields: AcknowledgementRequestEncryptedFields;
    encryptedInput: AcknowledgementRequestEncryptedInput;
    server: AcknowledgementRequestServerMetadata;
    result: AcknowledgementRequestResult;
    wire: AcknowledgementRequestWire;
  };
  TimerConfig: {
    domain: TimerConfig;
    encryptedFields: TimerConfigEncryptedFields;
    encryptedInput: TimerConfigEncryptedInput;
    server: TimerConfigServerMetadata;
    result: TimerConfigResult;
    wire: TimerConfigWire;
  };
  JournalEntry: {
    domain: JournalEntry;
    encryptedFields: JournalEntryEncryptedFields;
    encryptedInput: JournalEntryEncryptedInput;
    server: JournalEntryServerMetadata;
    result: JournalEntryResult;
    wire: JournalEntryWire;
  };
  WikiPage: {
    domain: WikiPage;
    encryptedFields: WikiPageEncryptedFields;
    encryptedInput: WikiPageEncryptedInput;
    server: WikiPageServerMetadata;
    result: WikiPageResult;
    wire: WikiPageWire;
  };
  // ── Cluster 9: Operational ────────────────────────────────────────────
  WebhookConfig: {
    domain: WebhookConfig;
    server: WebhookConfigServerMetadata;
    wire: WebhookConfigWire;
    // Plaintext entity — the T3 HMAC `secret` is readable by the server
    // but is not E2E encrypted user data. No encryptedFields union.
    encryptedFields: never;
  };
  WebhookDelivery: {
    domain: WebhookDelivery;
    server: WebhookDeliveryServerMetadata;
    wire: WebhookDeliveryWire;
    // Plaintext domain — the `encryptedData` payload is server-held T3
    // (not E2E), attached only to the server-side metadata.
    encryptedFields: never;
  };
  SyncDocument: {
    domain: SyncDocument;
    // SyncDocument has no server-only columns — the server sees the same
    // document-metadata shape as the client. Identity alias maintains
    // canonical-chain consistency across the plaintext fleet.
    server: SyncDocumentServerMetadata;
    wire: SyncDocumentWire;
    encryptedFields: never;
  };
  ImportJob: {
    domain: ImportJob;
    server: ImportJobServerMetadata;
    wire: ImportJobWire;
    // Plaintext domain — `checkpointState` is server-only resumption
    // state, attached only to the server-side metadata.
    encryptedFields: never;
  };
  ExportRequest: {
    domain: ExportRequest;
    server: ExportRequestServerMetadata;
    wire: ExportRequestWire;
    // Plaintext entity — identity case; the domain already exposes
    // everything the server tracks for an export request.
    encryptedFields: never;
  };
  // ── Cluster 10: Privacy-social ────────────────────────────────────────
  PrivacyBucket: {
    domain: PrivacyBucket;
    encryptedFields: PrivacyBucketEncryptedFields;
    encryptedInput: PrivacyBucketEncryptedInput;
    server: PrivacyBucketServerMetadata;
    result: PrivacyBucketResult;
    wire: PrivacyBucketWire;
  };
  BucketKeyRotation: {
    domain: BucketKeyRotation;
    server: BucketKeyRotationServerMetadata;
    wire: BucketKeyRotationWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  BucketRotationItem: {
    domain: BucketRotationItem;
    server: BucketRotationItemServerMetadata;
    wire: BucketRotationItemWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  KeyGrant: {
    domain: KeyGrant;
    server: KeyGrantServerMetadata;
    wire: KeyGrantWire;
    // Plaintext entity — the grant payload is an E2E ciphertext the server
    // treats opaquely, not a client-encrypted domain field.
    encryptedFields: never;
  };
  NotificationConfig: {
    domain: NotificationConfig;
    server: NotificationConfigServerMetadata;
    wire: NotificationConfigWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  FriendConnection: {
    domain: FriendConnection;
    encryptedFields: FriendConnectionEncryptedFields;
    encryptedInput: FriendConnectionEncryptedInput;
    server: FriendConnectionServerMetadata;
    result: FriendConnectionResult;
    wire: FriendConnectionWire;
  };
  FriendCode: {
    domain: FriendCode;
    server: FriendCodeServerMetadata;
    wire: FriendCodeWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  FriendNotificationPreference: {
    domain: FriendNotificationPreference;
    server: FriendNotificationPreferenceServerMetadata;
    wire: FriendNotificationPreferenceWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  FrontingReport: {
    domain: FrontingReport;
    encryptedFields: FrontingReportEncryptedFields;
    encryptedInput: FrontingReportEncryptedInput;
    server: FrontingReportServerMetadata;
    result: FrontingReportResult;
    wire: FrontingReportWire;
  };
};
