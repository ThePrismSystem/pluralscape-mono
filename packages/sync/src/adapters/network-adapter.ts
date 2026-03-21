import type { DocumentKeyType, SyncDocumentType } from "../document-types.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { BucketId, ChannelId, SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Manifest ─────────────────────────────────────────────────────────

/**
 * Metadata for a single document in the sync manifest.
 * The manifest itself is plaintext — it contains no sensitive content,
 * only document IDs, types, sizes, and timestamps.
 */
export interface SyncManifestEntry {
  /** Unique document identifier (e.g. "system-core-sys_abc", "chat-ch_xyz-2026-03"). */
  readonly docId: SyncDocumentId;
  /** Which sync document type this entry represents. */
  readonly docType: SyncDocumentType;
  /** Key type determining which encryption key is used. */
  readonly keyType: DocumentKeyType;
  /** Present for bucket documents — identifies which bucket. */
  readonly bucketId: BucketId | null;
  /** Present for chat documents — identifies which channel. */
  readonly channelId: ChannelId | null;
  /** Present for time-split documents (e.g. "2026-Q1", "2026-03", "2026"). */
  readonly timePeriod: string | null;
  /** Unix milliseconds when the document was created on the server. */
  readonly createdAt: number;
  /** Unix milliseconds when the last change was received. */
  readonly updatedAt: number;
  /** Approximate current document size in bytes. */
  readonly sizeBytes: number;
  /** Current snapshot version (monotonically increasing). */
  readonly snapshotVersion: number;
  /** Highest change sequence number for this document (monotonically increasing). */
  readonly lastSeq: number;
  /** Whether the document is archived (cold — no active writes for 90+ days). */
  readonly archived: boolean;
}

/**
 * A per-system manifest of all sync documents.
 * Owner devices receive the full manifest.
 * Friend devices receive a filtered manifest (only bucket documents with active KeyGrants).
 */
export interface SyncManifest {
  /** The system ID this manifest belongs to. */
  readonly systemId: SystemId;
  readonly documents: readonly SyncManifestEntry[];
}

// ── Subscription ─────────────────────────────────────────────────────

/**
 * Handle returned by SyncNetworkAdapter.subscribe().
 * Call unsubscribe() to stop receiving real-time updates.
 */
export interface SyncSubscription {
  unsubscribe(): void;
}

// ── Network Adapter ───────────────────────────────────────────────────

/**
 * Transport interface for encrypted CRDT sync operations.
 *
 * Implementations connect to the sync server (WebSocket, HTTP, or a local
 * relay for testing). The adapter never sees plaintext — it submits and
 * retrieves the same encrypted bytes produced by the encryption layer.
 *
 * Implementations: WebSocket (primary), HTTP long-polling (fallback), EncryptedRelay (test).
 */
export interface SyncNetworkAdapter {
  /**
   * Submits an encrypted change envelope to the server.
   * Returns the envelope with the server-assigned seq number.
   */
  submitChange(
    documentId: SyncDocumentId,
    change: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<EncryptedChangeEnvelope>;

  /**
   * Fetches all encrypted change envelopes for a document since a given seq (exclusive).
   * Returns envelopes in ascending seq order. Returns an empty array if none.
   */
  fetchChangesSince(
    documentId: SyncDocumentId,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]>;

  /**
   * Submits an encrypted snapshot to the server.
   * The server validates that snapshotVersion strictly increases.
   */
  submitSnapshot(documentId: SyncDocumentId, snapshot: EncryptedSnapshotEnvelope): Promise<void>;

  /**
   * Fetches the latest encrypted snapshot for a document.
   * Returns null if no snapshot exists yet.
   */
  fetchLatestSnapshot(documentId: SyncDocumentId): Promise<EncryptedSnapshotEnvelope | null>;

  /**
   * Subscribes to real-time change notifications for a document.
   * The callback is invoked with batches of new changes as they arrive.
   * Returns a subscription handle — call unsubscribe() to stop receiving updates.
   */
  subscribe(
    documentId: SyncDocumentId,
    onChanges: (changes: readonly EncryptedChangeEnvelope[]) => void,
  ): SyncSubscription;

  /**
   * Fetches the plaintext manifest for a system.
   * Owner devices receive the full manifest.
   * Friend devices receive a filtered manifest (bucket docs with active KeyGrants only).
   */
  fetchManifest(systemId: SystemId): Promise<SyncManifest>;

  /** Close the underlying transport and release resources. Optional. */
  close?(): void | Promise<void>;
}
