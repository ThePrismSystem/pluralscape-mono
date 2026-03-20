/**
 * Client-side sync engine.
 *
 * Orchestrates bootstrap (initial sync), steady-state change application,
 * and outbound change submission. Uses EncryptedSyncSession for CRDT
 * operations and the adapter interfaces for I/O.
 */
import { createDocument } from "../factories/document-factory.js";
import { filterManifest } from "../subscription-filter.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { DocumentKeyResolver } from "../document-key-resolver.js";
import type { SyncDocumentType } from "../document-types.js";
import type { DocumentSyncState, ReplicationProfile } from "../replication-profiles.js";
import type { EncryptedChangeEnvelope } from "../types.js";
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
}

/** Maximum changes to fetch per page during bootstrap. */
const BOOTSTRAP_FETCH_LIMIT = 1000;

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

  private readonly networkAdapter: SyncNetworkAdapter;
  private readonly storageAdapter: SyncStorageAdapter;
  private readonly keyResolver: DocumentKeyResolver;
  private readonly sodium: SodiumAdapter;
  private readonly profile: ReplicationProfile;
  private readonly systemId: string;
  private readonly onError: (message: string, error: unknown) => void;

  constructor(config: SyncEngineConfig) {
    this.networkAdapter = config.networkAdapter;
    this.storageAdapter = config.storageAdapter;
    this.keyResolver = config.keyResolver;
    this.sodium = config.sodium;
    this.profile = config.profile;
    this.systemId = config.systemId;
    this.onError = config.onError;
  }

  // ── Bootstrap ───────────────────────────────────────────────────────

  /**
   * Perform initial sync: fetch manifest, filter by profile, subscribe
   * to active documents, hydrate sessions from snapshots + catchup changes.
   */
  async bootstrap(): Promise<void> {
    // 1. Fetch manifest and local doc list
    const manifest = await this.networkAdapter.fetchManifest(this.systemId);
    const localDocIds = await this.storageAdapter.listDocuments();

    // 2. Apply replication profile filter
    const subscriptionSet = filterManifest(manifest, this.profile, localDocIds);

    // 3. Evict stale local docs
    for (const docId of subscriptionSet.evict) {
      await this.storageAdapter.deleteDocument(docId);
    }

    // 4. Hydrate each active document with bounded concurrency
    const results = await mapConcurrent(
      [...subscriptionSet.active],
      5,
      (entry) => this.hydrateDocument(entry.docId, entry.docType),
    );

    // Log failures but don't abort — partial bootstrap is better than none
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.status === "rejected") {
        const entry = subscriptionSet.active[i];
        this.onError(`Failed to hydrate document ${entry?.docId}`, result.reason);
      }
    }

    // 5. Subscribe for real-time updates
    for (const entry of subscriptionSet.active) {
      const session = this.sessions.get(entry.docId);
      if (!session) continue; // Skip failed hydrations
      const sub = this.networkAdapter.subscribe(
        entry.docId,
        (changes) => {
          this.enqueueDocumentOperation(entry.docId, () =>
            this.applyIncomingChanges(entry.docId, changes),
          ).catch((err: unknown) => {
            this.onError(`Error handling incoming changes for ${entry.docId}`, err);
          });
        },
        session.lastSyncedSeq,
      );
      this.subscriptions.push(sub);
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
   * Returns the server-assigned sequence number.
   */
  async applyLocalChange(docId: string, changeFn: (doc: unknown) => void): Promise<number> {
    return this.enqueueDocumentOperation(docId, async () => {
      const session = this.sessions.get(docId);
      if (!session) {
        throw new Error(`No active session for document: ${docId}`);
      }

      // Save document state for rollback
      const savedDoc = session.document;

      // Produce encrypted change (no seq yet)
      const envelope = session.change(changeFn);

      try {
        // Submit to server — get server-assigned seq
        const sequenced = await this.networkAdapter.submitChange(docId, envelope);

        // Persist locally with server seq
        await this.storageAdapter.appendChange(docId, sequenced);

        // Update sync state
        this.updateSyncState(docId, sequenced.seq);

        return sequenced.seq;
      } catch (error) {
        // Rollback on failure
        session.restoreDocument(savedDoc);
        throw error;
      }
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
    return this.enqueueDocumentOperation(docId, () =>
      this.applyIncomingChanges(docId, changes),
    );
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /** Unsubscribe from all documents and clear sessions. */
  dispose(): void {
    for (const sub of this.subscriptions) {
      try {
        sub.unsubscribe();
      } catch {
        // Best-effort cleanup
      }
    }
    this.subscriptions.length = 0;
    this.sessions.clear();
    this.syncStates.clear();
    this.documentQueues.clear();
    try { this.networkAdapter.close?.(); } catch { /* best-effort */ }
    try { this.storageAdapter.close?.(); } catch { /* best-effort */ }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private enqueueDocumentOperation<T>(docId: string, op: () => Promise<T>): Promise<T> {
    const prev = this.documentQueues.get(docId) ?? Promise.resolve();
    const next = prev.then(op, op);
    this.documentQueues.set(docId, next.then(() => {}, () => {}));
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

    // THEN persist (if this fails, data is still correct in memory; server will re-send)
    await this.persistChanges(docId, newChanges);

    // Update sync state to session's tracked seq
    this.updateSyncState(docId, session.lastSyncedSeq);
  }

  private async persistChanges(docId: string, changes: readonly EncryptedChangeEnvelope[]): Promise<void> {
    if (this.storageAdapter.appendChanges) {
      await this.storageAdapter.appendChanges(docId, changes);
    } else {
      for (const change of changes) {
        await this.storageAdapter.appendChange(docId, change);
      }
    }
  }

  private async hydrateDocument(docId: string, docType: SyncDocumentType): Promise<void> {
    const keys = this.keyResolver.resolveKeys(docId);

    // Try loading from local storage first
    const localSnapshot = await this.storageAdapter.loadSnapshot(docId);
    const localChanges = await this.storageAdapter.loadChangesSince(docId, 0);

    // Try fetching from server
    const serverSnapshot = await this.networkAdapter.fetchLatestSnapshot(docId);
    const serverSnapshotSeq = serverSnapshot?.snapshotVersion ?? 0;
    const localSnapshotSeq = localSnapshot?.snapshotVersion ?? 0;

    // Use whichever snapshot is newer
    const snapshot = serverSnapshotSeq > localSnapshotSeq ? serverSnapshot : localSnapshot;

    let session: EncryptedSyncSession<unknown>;

    if (snapshot) {
      session = EncryptedSyncSession.fromSnapshot(snapshot, keys, this.sodium);

      // Persist server snapshot locally if newer
      if (serverSnapshot && serverSnapshotSeq > localSnapshotSeq) {
        await this.storageAdapter.saveSnapshot(docId, serverSnapshot);
      }
    } else {
      // Fresh document — create empty
      session = new EncryptedSyncSession({
        doc: createDocument(docType) as Record<string, unknown>,
        keys,
        documentId: docId,
        sodium: this.sodium,
      });
    }

    // Apply local changes after the snapshot
    if (localChanges.length > 0) {
      const changesAfterSnapshot = localChanges.filter((c) => c.seq > session.lastSyncedSeq);
      if (changesAfterSnapshot.length > 0) {
        session.applyEncryptedChanges(changesAfterSnapshot);
      }
    }

    // Fetch server changes with pagination
    let cursor = session.lastSyncedSeq;
    let hasMore = true;
    while (hasMore) {
      const batch = await this.networkAdapter.fetchChangesSince(docId, cursor, BOOTSTRAP_FETCH_LIMIT);
      if (batch.length > 0) {
        session.applyEncryptedChanges(batch);

        // Persist batch
        await this.persistChanges(docId, batch);

        cursor = session.lastSyncedSeq;
      }
      hasMore = batch.length === BOOTSTRAP_FETCH_LIMIT;
    }

    this.sessions.set(docId, session);
    this.syncStates.set(docId, {
      docId,
      lastSyncedSeq: session.lastSyncedSeq,
      lastSnapshotVersion: snapshot?.snapshotVersion ?? 0,
      onDemand: false,
    });
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
  const results: PromiseSettledResult<R>[] = new Array(items.length);
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
