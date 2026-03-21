/**
 * Client-side sync engine.
 *
 * Orchestrates bootstrap (initial sync), steady-state change application,
 * and outbound change submission. Uses EncryptedSyncSession for CRDT
 * operations and the adapter interfaces for I/O.
 */
import { NoActiveSessionError } from "../errors.js";
import { createDocument } from "../factories/document-factory.js";
import { mapConcurrent } from "../map-concurrent.js";
import { replayOfflineQueue } from "../offline-queue-manager.js";
import { runAllValidations } from "../post-merge-validator.js";
import { filterManifest } from "../subscription-filter.js";
import { EncryptedSyncSession } from "../sync-session.js";
import {
  CORRECTION_ENVELOPE_CONCURRENCY,
  EVICTION_CONCURRENCY,
  HYDRATION_CONCURRENCY,
  MAX_CONFLICT_RETRY_BATCHES,
} from "../sync.constants.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { OfflineQueueAdapter } from "../adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { DocumentKeyResolver } from "../document-key-resolver.js";
import type { SyncDocumentType } from "../document-types.js";
import type { ReplayResult } from "../offline-queue-manager.js";
import type { DocumentSyncState, ReplicationProfile } from "../replication-profiles.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

/** Configuration for creating a SyncEngine. */
export interface SyncEngineConfig {
  readonly networkAdapter: SyncNetworkAdapter;
  readonly storageAdapter: SyncStorageAdapter;
  readonly keyResolver: DocumentKeyResolver;
  readonly sodium: SodiumAdapter;
  readonly profile: ReplicationProfile;
  readonly systemId: SystemId;
  /** Error handler for non-fatal errors (hydration failures, incoming change errors). */
  readonly onError: (message: string, error: unknown) => void;
  /** Callback invoked when a post-merge conflict is auto-resolved. */
  readonly onConflict?: (notification: ConflictNotification) => void;
  /** Optional adapter for persisting conflict records to a database. */
  readonly conflictPersistenceAdapter?: ConflictPersistenceAdapter;
  /** Optional adapter for offline queue persistence. When provided, local changes are enqueued before server submission. */
  readonly offlineQueueAdapter?: OfflineQueueAdapter;
  /** Maximum failed conflict persistence batches to retain for retry. Defaults to 100. */
  readonly maxConflictRetryBatches?: number;
}

/**
 * Client-side sync engine.
 *
 * Manages the lifecycle of encrypted sync sessions: bootstrap from
 * server manifest, apply remote changes, submit local changes.
 */
export class SyncEngine {
  private readonly sessions = new Map<string, EncryptedSyncSession<unknown>>();
  private readonly syncStates = new Map<string, DocumentSyncState>();
  private readonly subscriptions: Array<{ unsubscribe(): void }> = [];
  private readonly documentQueues = new Map<string, Promise<void>>();

  private readonly config: SyncEngineConfig;
  private failedConflictPersistence: Array<{
    documentId: string;
    notifications: readonly ConflictNotification[];
  }> = [];

  constructor(config: SyncEngineConfig) {
    this.config = config;
  }

  /** Number of documents with in-flight queued operations. */
  get pendingOperationCount(): number {
    return this.documentQueues.size;
  }

  // ── Bootstrap ───────────────────────────────────────────────────────

  /**
   * Perform initial sync: fetch manifest, filter by profile, subscribe
   * to active documents, hydrate sessions from snapshots + catchup changes.
   */
  async bootstrap(): Promise<void> {
    // 1. Fetch manifest and local doc list
    const manifest = await this.config.networkAdapter.fetchManifest(this.config.systemId);
    const localDocIds = await this.config.storageAdapter.listDocuments();

    // 2. Apply replication profile filter
    const subscriptionSet = filterManifest(manifest, this.config.profile, localDocIds);

    // 3. Evict stale local docs (parallel with bounded concurrency)
    const evictionResults = await mapConcurrent(
      subscriptionSet.evict,
      EVICTION_CONCURRENCY,
      (docId) => this.config.storageAdapter.deleteDocument(docId),
    );
    for (let i = 0; i < evictionResults.length; i++) {
      const result = evictionResults[i];
      if (result?.status === "rejected") {
        const docId = subscriptionSet.evict[i];
        this.config.onError(`Failed to evict document ${docId ?? "unknown"}`, result.reason);
      }
    }

    // 4. Hydrate each active document with bounded concurrency
    const results = await mapConcurrent(subscriptionSet.active, HYDRATION_CONCURRENCY, (entry) =>
      this.hydrateDocument(entry.docId, entry.docType, entry.snapshotVersion, entry.lastSeq),
    );

    // Log failures but don't abort — partial bootstrap is better than none
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result?.status === "rejected") {
        const entry = subscriptionSet.active[i];
        this.config.onError(
          `Failed to hydrate document ${entry?.docId ?? "unknown"}`,
          result.reason,
        );
      }
    }

    // 5. Subscribe for real-time updates
    for (const entry of subscriptionSet.active) {
      const session = this.sessions.get(entry.docId);
      if (!session) continue; // Skip failed hydrations
      const sub = this.config.networkAdapter.subscribe(entry.docId, (changes) => {
        this.enqueueDocumentOperation(entry.docId, () =>
          this.applyIncomingChanges(entry.docId, changes),
        ).catch((err: unknown) => {
          this.config.onError(`Error handling incoming changes for ${entry.docId}`, err);
        });
      });
      this.subscriptions.push(sub);
    }

    // 6. Replay offline queue if configured
    await this.replayOfflineQueue();
  }

  /**
   * Replay any queued offline changes.
   * Called automatically at end of bootstrap and can be called manually.
   */
  async replayOfflineQueue(): Promise<void> {
    if (!this.config.offlineQueueAdapter) return;

    try {
      const result: ReplayResult = await replayOfflineQueue({
        offlineQueueAdapter: this.config.offlineQueueAdapter,
        networkAdapter: this.config.networkAdapter,
        storageAdapter: this.config.storageAdapter,
        onError: this.config.onError,
      });

      // Load newly-persisted changes into in-memory sessions.
      // Routed through the document operation queue to serialize with
      // concurrent real-time pushes from active subscriptions.
      if (result.replayed > 0) {
        for (const [docId] of this.sessions) {
          await this.enqueueDocumentOperation(docId, async () => {
            const session = this.sessions.get(docId);
            if (!session) return;
            const changes = await this.config.storageAdapter.loadChangesSince(
              docId,
              session.lastSyncedSeq,
            );
            if (changes.length > 0) {
              session.applyEncryptedChanges(changes);
            }
          });
        }
      }

      if (result.failed > 0) {
        this.config.onError(
          `Offline queue replay completed with failures: ${String(result.failed)} failed, ${String(result.skipped)} skipped`,
          null,
        );
      }
    } catch (error) {
      this.config.onError("Offline queue replay failed", error);
    }
  }

  // ── Session access ──────────────────────────────────────────────────

  /**
   * Get a hydrated session by document ID.
   * Note: The generic type T is caller-asserted — the engine stores sessions
   * as EncryptedSyncSession<unknown>. Callers must ensure T matches the
   * actual document type for the given docId.
   */
  getSession<T>(docId: string): EncryptedSyncSession<T> | undefined {
    return this.sessions.get(docId) as EncryptedSyncSession<T> | undefined;
  }

  /** Get sync state for a document. */
  getSyncState(docId: string): DocumentSyncState | undefined {
    return this.syncStates.get(docId);
  }

  /** Get all active document IDs. */
  getActiveDocIds(): readonly string[] {
    return [...this.sessions.keys()];
  }

  // ── Steady-state: outbound ──────────────────────────────────────────

  /**
   * Apply a local change to a document and submit to the server.
   *
   * Three-phase flow when offlineQueueAdapter is configured:
   * 1. Enqueue locally (pending, no seq)
   * 2. Submit to server
   * 3. On ChangeAccepted: persist + markSynced
   *
   * If step 2 fails (offline), the entry stays with synced_at = null
   * for replay on reconnect.
   *
   * Returns the server-assigned sequence number.
   */
  async applyLocalChange(docId: SyncDocumentId, changeFn: (doc: unknown) => void): Promise<number> {
    return this.enqueueDocumentOperation(docId, async () => {
      const session = this.sessions.get(docId);
      if (!session) {
        throw new NoActiveSessionError(docId);
      }

      // Produce encrypted change (no seq yet)
      const envelope = session.change(changeFn);

      // Phase 1: Enqueue locally if offline queue adapter is configured
      let queueEntryId: string | undefined;
      if (this.config.offlineQueueAdapter) {
        queueEntryId = await this.config.offlineQueueAdapter.enqueue(docId, envelope);
      }

      // Phase 2: Submit to server
      const sequenced = await this.config.networkAdapter.submitChange(docId, envelope);

      // Phase 3: On success, persist locally and mark synced
      await this.config.storageAdapter.appendChange(docId, sequenced);

      if (this.config.offlineQueueAdapter && queueEntryId !== undefined) {
        await this.config.offlineQueueAdapter.markSynced(queueEntryId, sequenced.seq);
      }

      // Update sync state
      this.updateSyncState(docId, sequenced.seq);

      return sequenced.seq;
    });
  }

  // ── Steady-state: inbound ──────────────────────────────────────────

  /**
   * Handle incoming changes from server push (DocumentUpdate).
   * Routes through the per-document operation queue.
   */
  async handleIncomingChanges(
    docId: SyncDocumentId,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void> {
    return this.enqueueDocumentOperation(docId, () => this.applyIncomingChanges(docId, changes));
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /** Unsubscribe from all documents and clear sessions. */
  dispose(): void {
    for (const sub of this.subscriptions) {
      try {
        sub.unsubscribe();
      } catch (error) {
        this.config.onError("Failed to unsubscribe during dispose", error);
      }
    }
    this.subscriptions.length = 0;
    this.sessions.clear();
    this.syncStates.clear();
    this.documentQueues.clear();
    if (typeof this.config.networkAdapter.close === "function") {
      try {
        const result = this.config.networkAdapter.close();
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.config.onError("Failed to close network adapter during dispose", error);
          });
        }
      } catch (error) {
        this.config.onError("Failed to close network adapter during dispose", error);
      }
    }
    if (typeof this.config.storageAdapter.close === "function") {
      try {
        const result = this.config.storageAdapter.close();
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.config.onError("Failed to close storage adapter during dispose", error);
          });
        }
      } catch (error) {
        this.config.onError("Failed to close storage adapter during dispose", error);
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private enqueueDocumentOperation<T>(docId: string, op: () => Promise<T>): Promise<T> {
    const prev = this.documentQueues.get(docId) ?? Promise.resolve();
    const next = prev.then(op, op);
    // Store void-wrapped version and schedule cleanup after resolution
    const voidPromise = next.then(
      () => {},
      () => {},
    );
    this.documentQueues.set(docId, voidPromise);
    // Remove the queue entry once settled, unless a newer operation replaced it
    void voidPromise.then(() => {
      if (this.documentQueues.get(docId) === voidPromise) {
        this.documentQueues.delete(docId);
      }
    });
    return next;
  }

  /**
   * Apply incoming changes: apply to session first, then persist.
   * If applyEncryptedChanges throws (crypto failure), data is NOT persisted
   * to storage — the server will re-send on next connect.
   */
  private async applyIncomingChanges(
    docId: SyncDocumentId,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void> {
    const session = this.sessions.get(docId);
    if (!session) return;

    const currentSeq = session.lastSyncedSeq;

    // Filter to only changes we haven't seen
    const newChanges = changes.filter((c) => c.seq > currentSeq);
    if (newChanges.length === 0) return;

    // Apply FIRST (has built-in rollback on crypto failure)
    session.applyEncryptedChanges(newChanges);

    // Run post-merge validation to correct merge artifacts
    await this.runPostMergeValidation(docId, session);

    // THEN persist (if this fails, data is still correct in memory; server will re-send)
    await this.persistChanges(docId, newChanges);

    // Update sync state to session's tracked seq
    this.updateSyncState(docId, session.lastSyncedSeq);
  }

  private async persistChanges(
    docId: SyncDocumentId,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void> {
    if (this.config.storageAdapter.appendChanges) {
      await this.config.storageAdapter.appendChanges(docId, changes);
    } else {
      for (const change of changes) {
        await this.config.storageAdapter.appendChange(docId, change);
      }
    }
  }

  private async hydrateDocument(
    docId: SyncDocumentId,
    docType: SyncDocumentType,
    manifestSnapshotVersion?: number,
    manifestLastSeq?: number,
  ): Promise<void> {
    const keys = this.config.keyResolver.resolveKeys(docId);

    // Try loading from local storage first
    const localSnapshot = await this.config.storageAdapter.loadSnapshot(docId);
    const localChanges = await this.config.storageAdapter.loadChangesSince(docId, 0);

    // Determine local high-water marks from snapshot + changes
    const localSnapshotSeq = localSnapshot?.snapshotVersion ?? 0;
    const localMaxSeq =
      localChanges.length > 0
        ? Math.max(localSnapshotSeq, localChanges[localChanges.length - 1]?.seq ?? 0)
        : localSnapshotSeq;
    const serverSnapshotVer = manifestSnapshotVersion ?? 0;
    const serverLastSeq = manifestLastSeq ?? 0;

    // Skip snapshot fetch when local snapshot already matches or exceeds
    // the server's snapshot version. Version 0 means never snapshotted — always fetch.
    const snapshotUpToDate = serverSnapshotVer > 0 && localSnapshotSeq >= serverSnapshotVer;

    // Skip change fetch when local high-water mark matches or exceeds the
    // server's last change seq. Seq 0 means no changes recorded — always fetch.
    const changesUpToDate = serverLastSeq > 0 && localMaxSeq >= serverLastSeq;

    // Try fetching from server (skip if local snapshot is current)
    const serverSnapshot = snapshotUpToDate
      ? null
      : await this.config.networkAdapter.fetchLatestSnapshot(docId);
    const serverSnapshotSeq = serverSnapshot?.snapshotVersion ?? 0;

    // Use whichever snapshot is newer
    const snapshot = serverSnapshotSeq > localSnapshotSeq ? serverSnapshot : localSnapshot;

    let session: EncryptedSyncSession<unknown>;

    if (snapshot) {
      session = EncryptedSyncSession.fromSnapshot(snapshot, keys, this.config.sodium);

      // Persist server snapshot locally if newer
      if (serverSnapshot && serverSnapshotSeq > localSnapshotSeq) {
        await this.config.storageAdapter.saveSnapshot(docId, serverSnapshot);
      }
    } else {
      // Fresh document — create empty
      session = new EncryptedSyncSession({
        doc: createDocument(docType) as Record<string, unknown>,
        keys,
        documentId: docId,
        sodium: this.config.sodium,
      });
    }

    // Apply local changes after the snapshot
    if (localChanges.length > 0) {
      const changesAfterSnapshot = localChanges.filter((c) => c.seq > session.lastSyncedSeq);
      if (changesAfterSnapshot.length > 0) {
        session.applyEncryptedChanges(changesAfterSnapshot);
      }
    }

    // Fetch server changes since last known seq (skip if local is current)
    if (!changesUpToDate) {
      const changes = await this.config.networkAdapter.fetchChangesSince(
        docId,
        session.lastSyncedSeq,
      );
      if (changes.length > 0) {
        session.applyEncryptedChanges(changes);

        // Run post-merge validation to correct merge artifacts
        await this.runPostMergeValidation(docId, session);

        await this.persistChanges(docId, changes);
      }
    }

    this.sessions.set(docId, session);
    this.syncStates.set(docId, {
      docId,
      lastSyncedSeq: session.lastSyncedSeq,
      lastSnapshotVersion: snapshot?.snapshotVersion ?? 0,
      onDemand: false,
    });
  }

  private async runPostMergeValidation(
    docId: SyncDocumentId,
    session: EncryptedSyncSession<unknown>,
  ): Promise<void> {
    // runAllValidations never throws — each validator is independently try/caught
    const result = runAllValidations(session, this.config.onError);
    const { correctionEnvelopes, notifications } = result;

    // Submit correction envelopes to server and persist locally
    await submitCorrectionEnvelopes(this.config, docId, correctionEnvelopes);

    // Fire onConflict callbacks
    if (this.config.onConflict) {
      for (const notification of notifications) {
        this.config.onConflict(notification);
      }
    }

    // Persist conflict records (best-effort, with retry of previously failed)
    await this.persistConflicts(docId, notifications);
  }

  private async persistConflicts(
    docId: string,
    notifications: readonly ConflictNotification[],
  ): Promise<void> {
    if (!this.config.conflictPersistenceAdapter) return;

    // Include previously failed attempts
    const retryBatch = [...this.failedConflictPersistence];
    this.failedConflictPersistence = [];

    if (notifications.length > 0) {
      retryBatch.push({ documentId: docId, notifications });
    }

    for (const batch of retryBatch) {
      try {
        await this.config.conflictPersistenceAdapter.saveConflicts(
          batch.documentId,
          batch.notifications,
        );
      } catch (error) {
        this.config.onError("Failed to persist conflict records", error);
        this.failedConflictPersistence.push(batch);
      }
    }

    // Cap the retry buffer to prevent unbounded growth
    const cap = this.config.maxConflictRetryBatches ?? MAX_CONFLICT_RETRY_BATCHES;
    if (this.failedConflictPersistence.length > cap) {
      const dropped = this.failedConflictPersistence.length - cap;
      this.failedConflictPersistence = this.failedConflictPersistence.slice(dropped);
      this.config.onError(
        `Conflict retry buffer exceeded cap (${String(cap)}), dropped ${String(dropped)} oldest entries`,
        null,
      );
    }
  }

  private updateSyncState(docId: string, seq: number): void {
    const existing = this.syncStates.get(docId);
    this.syncStates.set(docId, {
      docId,
      lastSyncedSeq: seq,
      lastSnapshotVersion: existing?.lastSnapshotVersion ?? 0,
      onDemand: existing?.onDemand ?? false,
    });
  }
}

// ── Correction envelope submission ──────────────────────────────────

/**
 * Submits correction envelopes to the server and persists locally.
 *
 * Two-phase approach: first submit all to network in parallel, then
 * persist all successful submissions locally. This ensures a persist
 * failure for one envelope doesn't block submission of others.
 *
 * @internal Exported for testing only.
 */
export async function submitCorrectionEnvelopes(
  config: Pick<SyncEngineConfig, "networkAdapter" | "storageAdapter" | "onError">,
  docId: SyncDocumentId,
  envelopes: readonly Omit<EncryptedChangeEnvelope, "seq">[],
): Promise<void> {
  if (envelopes.length === 0) return;

  // Phase 1: Submit to network with bounded concurrency
  const submitResults = await mapConcurrent(
    envelopes,
    CORRECTION_ENVELOPE_CONCURRENCY,
    (envelope) => config.networkAdapter.submitChange(docId, envelope),
  );

  // Collect successfully sequenced envelopes
  const sequenced: EncryptedChangeEnvelope[] = [];
  for (const result of submitResults) {
    if (result.status === "fulfilled") {
      sequenced.push(result.value);
    } else {
      config.onError(`Failed to submit correction envelope for ${docId}`, result.reason);
    }
  }

  // Phase 2: Persist all successful submissions locally with bounded concurrency
  const persistResults = await mapConcurrent(
    sequenced,
    CORRECTION_ENVELOPE_CONCURRENCY,
    (envelope) => config.storageAdapter.appendChange(docId, envelope),
  );

  for (const result of persistResults) {
    if (result.status === "rejected") {
      config.onError(`Failed to persist correction envelope for ${docId}`, result.reason);
    }
  }
}
