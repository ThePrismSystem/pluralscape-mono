// @pluralscape/sync — Encrypted CRDT sync over relay
//
// Root barrel exports core types, session, engine, document factory, and
// protocol messages. Specialized exports live behind sub-entry points:
//   @pluralscape/sync/adapters  — storage/network adapters and SQLite drivers
//   @pluralscape/sync/schemas   — CRDT document schema types
//   @pluralscape/sync/protocol  — full protocol message taxonomy

// ── Core types ───────────────────────────────────────────────────────
export type {
  DocumentKeys,
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  CompactionConfig,
  TimeSplitConfig,
  TimeSplitUnit,
  StorageBudget,
  CompactionCheck,
  SyncPriorityCategory,
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

// ── Encryption ───────────────────────────────────────────────────────
export {
  encryptChange,
  decryptChange,
  encryptSnapshot,
  decryptSnapshot,
  verifyEnvelopeSignature,
  SignatureVerificationError,
} from "./encrypted-sync.js";

// ── Errors ───────────────────────────────────────────────────────────
export {
  SyncProtocolError,
  UnexpectedResponseError,
  SyncTimeoutError,
  AdapterDisposedError,
  NoChangeProducedError,
  UnsupportedDocumentTypeError,
  DocumentNotFoundError,
} from "./errors.js";

// ── Relay ────────────────────────────────────────────────────────────
export type { PaginatedEnvelopes, SyncRelayService } from "./relay-service.js";
export {
  RELAY_MAX_ENVELOPES_PER_DOCUMENT,
  RELAY_MAX_SNAPSHOT_SIZE_BYTES,
} from "./relay.constants.js";
export {
  EncryptedRelay,
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
  SnapshotVersionConflictError,
} from "./relay.js";
export type { RelayDocumentState, RelayOptions } from "./relay.js";

// ── Session ──────────────────────────────────────────────────────────
export { EncryptedSyncSession, syncThroughRelay } from "./sync-session.js";

// ── Document identity ────────────────────────────────────────────────
export type { DocumentKeyType, ParsedDocumentId, SyncDocumentType } from "./document-types.js";
export { InvalidDocumentIdError, parseDocumentId } from "./document-types.js";

// ── Document key resolver ────────────────────────────────────────────
export type { DocumentKeyResolverConfig } from "./document-key-resolver.js";
export { BucketKeyNotFoundError, DocumentKeyResolver } from "./document-key-resolver.js";

// ── CRDT strategies ──────────────────────────────────────────────────
export { ENTITY_CRDT_STRATEGIES } from "./strategies/crdt-strategies.js";
export type {
  CrdtStorageType,
  CrdtStrategy,
  SyncedEntityType,
} from "./strategies/crdt-strategies.js";

// ── Document factories ───────────────────────────────────────────────
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

// ── Post-merge validation ────────────────────────────────────────────
export { runAllValidations } from "./post-merge-validator.js";
export type { ConflictPersistenceAdapter, PersistedConflict } from "./conflict-persistence.js";

// ── Offline queue management ─────────────────────────────────────────
export { replayOfflineQueue } from "./offline-queue-manager.js";
export type { ReplayResult, ReplayOfflineQueueConfig } from "./offline-queue-manager.js";

// ── Compaction & document lifecycle ───────────────────────────────────
export { checkCompactionEligibility, LazyDocumentSizeTracker } from "./compaction.js";

// ── Time-splitting ───────────────────────────────────────────────────
export type { TimeSplitResult } from "./time-split.js";
export {
  checkTimeSplitEligibility,
  computeNewDocumentId,
  computeNextTimePeriod,
  splitDocument,
} from "./time-split.js";

// ── Storage budget ───────────────────────────────────────────────────
export type { StorageBudgetStatus } from "./storage-budget.js";
export { checkStorageBudget, selectEvictionCandidates } from "./storage-budget.js";

// ── Subscription filtering ───────────────────────────────────────────
export { filterManifest } from "./subscription-filter.js";

// ── On-demand document loading ───────────────────────────────────────
export type { OnDemandLoadResult } from "./on-demand-loader.js";
export { requestOnDemandDocument } from "./on-demand-loader.js";

// ── Replication profiles ──────────────────────────────────────────────
export type {
  ReplicationProfileType,
  ReplicationProfile,
  OwnerFullProfile,
  OwnerLiteProfile,
  FriendProfile,
  DocumentSyncState,
  SubscriptionSet,
  OnDemandLoadRequest,
} from "./replication-profiles.js";
export { DEFAULT_OWNER_FULL_PROFILE, DEFAULT_OWNER_LITE_PROFILE } from "./replication-profiles.js";

// ── Protocol messages ────────────────────────────────────────────────
export type {
  TransportState,
  SyncTransport,
  SyncMessageBase,
  SyncErrorCode,
  DocumentVersionEntry,
  DocumentCatchup,
  AuthenticateRequest,
  ManifestRequest,
  SubscribeRequest,
  UnsubscribeRequest,
  FetchSnapshotRequest,
  FetchChangesRequest,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  DocumentLoadRequest,
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

// ── Sync engine ─────────────────────────────────────────────────────
export { SyncEngine } from "./engine/index.js";
export type { SyncEngineConfig } from "./engine/index.js";
