/**
 * Client-side sync engine.
 *
 * Orchestrates bootstrap (initial sync), steady-state change application,
 * and outbound change submission. Uses EncryptedSyncSession for CRDT
 * operations and the adapter interfaces for I/O.
 */
import { createDocument } from "../factories/document-factory.js";
import { OfflineQueueManager } from "../offline-queue-manager.js";
import { PostMergeValidator } from "../post-merge-validator.js";
import { filterManifest } from "../subscription-filter.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { OfflineQueueAdapter } from "../adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { DocumentKeyResolver } from "../document-key-resolver.js";
import type { SyncDocumentType } from "../document-types.js";
import type { DocumentSyncState, ReplicationProfile } from "../replication-profiles.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

/** Configuration for creating a SyncEngine. */
export interface SyncEngineConfig {
  readonly networkAdapter: SyncNetworkAdapter;
  readonly storageAdapter: SyncStorageAdapter;
  readonly keyResolver: DocumentKeyResolver;
  readonly sodium: SodiumAdapter;
  readonly profile: ReplicationProfile;
  readonly systemId: string;
  /** Error handler for non-fatal errors (hydration failures, incoming change errors). */
  readonly onError: (message: string, error: unknown) => void;
  /** Callback invoked when a post-merge conflict is auto-resolved. */
  readonly onConflict?: (notification: ConflictNotification) => void;
  /** Optional adapter for persisting conflict records to a database. */
  readonly conflictPersistenceAdapter?: ConflictPersistenceAdapter;
  /** Optional adapter for offline queue persistence. When provided, local changes are enqueued before server submission. */
  readonly offlineQueueAdapter?: OfflineQueueAdapter;
}

/** Maximum parallel document hydrations during bootstrap. */
const HYDRATION_CONCURRENCY = 5;

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
  private readonly postMergeValidator = new PostMergeValidator();
  private readonly offlineQueueManager?: OfflineQueueManager;
  private failedConflictPersistence: Array<{
    documentId: string;
    notifications: readonly ConflictNotification[];
  }> = [];

  constructor(config: SyncEngineConfig) {
    this.config = config;

    if (config.offlineQueueAdapter) {
      this.offlineQueueManager = new OfflineQueueManager({
        offlineQueueAdapter: config.offlineQueueAdapter,
        networkAdapter: config.networkAdapter,
        storageAdapter: config.storageAdapter,
        onError: config.onError,
      });
    }
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

    // 3. Evict stale local docs
    for (const docId of subscriptionSet.evict) {
      await this.config.storageAdapter.deleteDocument(docId);
    }

    // 4. Hydrate each active document with bounded concurrency
    const results = await mapConcurrent(
      [...subscriptionSet.active],
      HYDRATION_CONCURRENCY,
      (entry) => this.hydrateDocument(entry.docId, entry.docType),
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
    if (!this.offlineQueueManager) return;

    try {
      const result = await this.offlineQueueManager.replay();

      // Load newly-persisted changes into in-memory sessions
      if (result.replayed > 0) {
        for (const [docId, session] of this.sessions) {
          const changes = await this.config.storageAdapter.loadChangesSince(
            docId,
            session.lastSyncedSeq,
          );
          if (changes.length > 0) {
            session.applyEncryptedChanges(changes);
          }
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
  async applyLocalChange(docId: string, changeFn: (doc: unknown) => void): Promise<number> {
    return this.enqueueDocumentOperation(docId, async () => {
      const session = this.sessions.get(docId);
      if (!session) {
        throw new Error(`No active session for document: ${docId}`);
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
    docId: string,
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
    try {
      (this.config.networkAdapter as { close?(): void }).close?.();
    } catch (error) {
      this.config.onError("Failed to close network adapter during dispose", error);
    }
    try {
      (this.config.storageAdapter as { close?(): void }).close?.();
    } catch (error) {
      this.config.onError("Failed to close storage adapter during dispose", error);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private enqueueDocumentOperation<T>(docId: string, op: () => Promise<T>): Promise<T> {
    const prev = this.documentQueues.get(docId) ?? Promise.resolve();
    const next = prev.then(op, op);
    this.documentQueues.set(
      docId,
      next.then(
        () => {},
        () => {},
      ),
    );
    return next;
  }

  /**
   * Apply incoming changes: apply to session first, then persist.
   * If applyEncryptedChanges throws (crypto failure), data is NOT persisted
   * to storage — the server will re-send on next connect.
   */
  private async applyIncomingChanges(
    docId: string,
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
    docId: string,
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

  private async hydrateDocument(docId: string, docType: SyncDocumentType): Promise<void> {
    const keys = this.config.keyResolver.resolveKeys(docId);

    // Try loading from local storage first
    const localSnapshot = await this.config.storageAdapter.loadSnapshot(docId);
    const localChanges = await this.config.storageAdapter.loadChangesSince(docId, 0);

    // Try fetching from server
    const serverSnapshot = await this.config.networkAdapter.fetchLatestSnapshot(docId);
    const serverSnapshotSeq = serverSnapshot?.snapshotVersion ?? 0;
    const localSnapshotSeq = localSnapshot?.snapshotVersion ?? 0;

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

    // Fetch server changes since last known seq
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

    this.sessions.set(docId, session);
    this.syncStates.set(docId, {
      docId,
      lastSyncedSeq: session.lastSyncedSeq,
      lastSnapshotVersion: snapshot?.snapshotVersion ?? 0,
      onDemand: false,
    });
  }

  private async runPostMergeValidation(
    docId: string,
    session: EncryptedSyncSession<unknown>,
  ): Promise<void> {
    let notifications: readonly ConflictNotification[] = [];
    let correctionEnvelopes: readonly Omit<EncryptedChangeEnvelope, "seq">[] = [];

    // Run validations — notification construction is handled by PostMergeValidator
    try {
      const result = this.postMergeValidator.runAllValidations(session);
      correctionEnvelopes = result.correctionEnvelopes;
      notifications = result.notifications;
    } catch (error) {
      this.config.onError("Post-merge validation failed", error);
    }

    // Submit correction envelopes to server and persist locally
    await this.submitCorrectionEnvelopes(docId, correctionEnvelopes);

    // Fire onConflict callbacks
    if (this.config.onConflict) {
      for (const notification of notifications) {
        this.config.onConflict(notification);
      }
    }

    // Persist conflict records (best-effort, with retry of previously failed)
    await this.persistConflicts(docId, notifications);
  }

  protected async submitCorrectionEnvelopes(
    docId: string,
    envelopes: readonly Omit<EncryptedChangeEnvelope, "seq">[],
  ): Promise<void> {
    if (envelopes.length === 0) return;

    const results = await Promise.allSettled(
      envelopes.map(async (envelope) => {
        const sequenced = await this.config.networkAdapter.submitChange(docId, envelope);
        await this.config.storageAdapter.appendChange(docId, sequenced);
      }),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        this.config.onError(`Failed to submit correction envelope for ${docId}`, result.reason);
      }
    }
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

// ── Utility ─────────────────────────────────────────────────────────

/**
 * Runs `fn` over `items` with bounded concurrency, returning settled results.
 * Safe in single-threaded JS: `index++` is atomic within a synchronous tick.
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = Array.from<PromiseSettledResult<R>>({ length: items.length });
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const item = items[i] as T;
      try {
        const value = await fn(item);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
