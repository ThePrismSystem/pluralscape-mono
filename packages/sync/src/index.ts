// @pluralscape/sync — Encrypted CRDT sync over relay
export type {
  DocumentKeys,
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  CompactionConfig,
  TimeSplitConfig,
  TimeSplitUnit,
  StorageBudget,
  CompactionCheck,
  ConflictNotification,
  ConflictResolutionStrategy,
  CycleBreak,
  SortOrderPatch,
  PostMergeValidationResult,
} from "./types.js";
export {
  DEFAULT_COMPACTION_CONFIG,
  TIME_SPLIT_CONFIGS,
  DOCUMENT_SIZE_LIMITS,
  DEFAULT_STORAGE_BUDGET,
  SYNC_PRIORITY_ORDER,
  StorageBudgetExceededError,
} from "./types.js";

export {
  encryptChange,
  decryptChange,
  encryptSnapshot,
  decryptSnapshot,
  verifyEnvelopeSignature,
  SignatureVerificationError,
} from "./encrypted-sync.js";

export { EncryptedRelay } from "./relay.js";
export type { RelayDocumentState } from "./relay.js";

export { EncryptedSyncSession, syncThroughRelay } from "./sync-session.js";

export type { DocumentKeyType, ParsedDocumentId, SyncDocumentType } from "./document-types.js";
export { InvalidDocumentIdError, parseDocumentId } from "./document-types.js";

export type { DocumentKeyResolverConfig } from "./document-key-resolver.js";
export { BucketKeyNotFoundError, DocumentKeyResolver } from "./document-key-resolver.js";

// ── Document schemas ──────────────────────────────────────────────────
export type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./schemas/common.js";
export type {
  CrdtSystem,
  CrdtSystemSettings,
  CrdtMember,
  CrdtMemberPhoto,
  CrdtGroup,
  CrdtSubsystem,
  CrdtSideSystem,
  CrdtLayer,
  CrdtRelationship,
  CrdtCustomFront,
  CrdtFieldDefinition,
  CrdtFieldValue,
  CrdtInnerWorldEntity,
  CrdtInnerWorldRegion,
  CrdtTimer,
  CrdtLifecycleEvent,
  SystemCoreDocument,
} from "./schemas/system-core.js";
export type {
  CrdtFrontingSession,
  CrdtFrontingComment,
  CrdtSwitch,
  CrdtCheckInRecord,
  FrontingDocument,
} from "./schemas/fronting.js";
export type {
  CrdtChannel,
  CrdtChatMessage,
  CrdtBoardMessage,
  CrdtPoll,
  CrdtPollOption,
  CrdtPollVote,
  CrdtAcknowledgementRequest,
  ChatDocument,
} from "./schemas/chat.js";
export type {
  CrdtJournalEntry,
  CrdtWikiPage,
  CrdtNote,
  JournalDocument,
} from "./schemas/journal.js";
export type {
  CrdtPrivacyBucket,
  CrdtBucketContentTag,
  CrdtFriendConnection,
  CrdtFriendCode,
  CrdtKeyGrant,
  PrivacyConfigDocument,
} from "./schemas/privacy-config.js";
export type { BucketProjectionDocument } from "./schemas/bucket.js";

// ── CRDT strategies ───────────────────────────────────────────────────
export { ENTITY_CRDT_STRATEGIES } from "./strategies/crdt-strategies.js";
export type {
  CrdtStorageType,
  CrdtStrategy,
  SyncedEntityType,
} from "./strategies/crdt-strategies.js";

// ── Document factories ────────────────────────────────────────────────
export {
  createDocument,
  createSystemCoreDocument,
  createFrontingDocument,
  createChatDocument,
  createJournalDocument,
  createPrivacyConfigDocument,
  createBucketDocument,
  fromDoc,
} from "./factories/document-factory.js";

// ── Adapter interfaces ────────────────────────────────────────────────
export type { SyncStorageAdapter } from "./adapters/storage-adapter.js";
export type {
  SyncManifest,
  SyncManifestEntry,
  SyncNetworkAdapter,
  SyncSubscription,
} from "./adapters/network-adapter.js";

// ── Replication profiles ──────────────────────────────────────────────
export type {
  ReplicationProfileType,
  ReplicationProfile,
  OwnerFullProfile,
  OwnerLiteConfig,
  FriendProfileConfig,
  DocumentSyncState,
  SubscriptionSet,
  DocumentLoadRequest,
} from "./replication-profiles.js";
export { DEFAULT_OWNER_FULL_PROFILE, DEFAULT_OWNER_LITE_CONFIG } from "./replication-profiles.js";

// ── Protocol messages ──────────────────────────────────────────────────
export type {
  TransportState,
  SyncTransport,
  SyncMessageBase,
  DocumentVersionEntry,
  DocumentCatchup,
  SyncErrorCode,
  AuthenticateRequest,
  ManifestRequest,
  SubscribeRequest,
  UnsubscribeRequest,
  FetchSnapshotRequest,
  FetchChangesRequest,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  DocumentLoadRequest as ProtocolDocumentLoadRequest,
  AuthenticateResponse,
  ManifestResponse,
  SubscribeResponse,
  DocumentUpdate,
  SnapshotResponse,
  ChangesResponse,
  ChangeAccepted,
  SnapshotAccepted,
  ManifestChanged,
  SyncError,
  ClientMessage,
  ServerMessage,
  SyncMessage,
} from "./protocol.js";
export { SYNC_PROTOCOL_VERSION } from "./protocol.js";
