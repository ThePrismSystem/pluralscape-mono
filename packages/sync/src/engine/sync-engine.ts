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
import type { DocumentSyncState, ReplicationProfile } from "../replication-profiles.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocType } from "@pluralscape/types";

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

/** Maximum parallel document hydrations during bootstrap. */
const HYDRATION_CONCURRENCY = 5;

/** Compute the maximum seq from a set of changes without spread (stack-safe for large arrays). */
function computeMaxSeq(changes: readonly { seq: number }[], current: number): number {
  let max = current;
  for (const c of changes) {
    if (c.seq > max) max = c.seq;
  }
  return max;
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
  private readonly config: SyncEngineConfig;

  constructor(config: SyncEngineConfig) {
    this.config = config;
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

    // 3. Hydrate each active document (before eviction, so failed hydration doesn't leave less data)
    const failedDocIds = new Set<string>();
    for (const entry of subscriptionSet.active) {
      try {
        await this.hydrateDocument(entry.docId, entry.docType);
      } catch (error: unknown) {
        failedDocIds.add(entry.docId);
        console.warn("[SyncEngine] hydration failed for document", entry.docId, error);
      }
    }

    // 4. Evict stale local docs (after hydration), skip docs that failed hydration
    for (const docId of subscriptionSet.evict) {
      if (!failedDocIds.has(docId)) {
        await this.config.storageAdapter.deleteDocument(docId);
      }
    }

    // 5. Subscribe for real-time updates
    for (const entry of subscriptionSet.active) {
      const sub = this.config.networkAdapter.subscribe(entry.docId, (changes) => {
        void this.handleIncomingChanges(entry.docId, changes).catch((error: unknown) => {
          console.warn("[SyncEngine] handleIncomingChanges failed for", entry.docId, error);
        });
      });
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

      // Produce encrypted change (no seq yet)
      const envelope = session.change(changeFn);

    // Submit to server — get server-assigned seq
    const sequenced = await this.config.networkAdapter.submitChange(docId, envelope);

    // Persist locally with server seq
    await this.config.storageAdapter.appendChange(docId, sequenced);

        // Update sync state
        this.updateSyncState(docId, sequenced.seq);

        return sequenced.seq;
      } catch (error) {
        throw error;
      }
    });
  }

  // ── Steady-state: inbound ──────────────────────────────────────────

  /**
   * Handle incoming changes from server push (DocumentUpdate).
   * Applies to CRDT first (validates decryption + Automerge), then persists.
   * If CRDT application fails, nothing is persisted — no poisoned state.
   */
  async handleIncomingChanges(
    docId: string,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void> {
    const session = this.sessions.get(docId);
    if (!session) return;

    if (changes.length === 0) return;

    // Apply to CRDT first — validates decryption + Automerge integrity.
    // Session has internal rollback semantics if this throws.
    session.applyEncryptedChanges(changes);

    // Only persist after successful CRDT application
    for (const change of changes) {
      await this.config.storageAdapter.appendChange(docId, change);
    }

    // Update sync state to highest seq
    const currentSeq = this.syncStates.get(docId)?.lastSyncedSeq ?? 0;
    this.updateSyncState(docId, computeMaxSeq(changes, currentSeq));
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

    // Dispose network adapter if it supports it
    if (
      "dispose" in this.config.networkAdapter &&
      typeof this.config.networkAdapter.dispose === "function"
    ) {
      (this.config.networkAdapter as { dispose(): void }).dispose();
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private async hydrateDocument(docId: string, docType: SyncDocType): Promise<void> {
    const keys = this.config.keyResolver.resolveKeys(docId);

    // Try loading from local storage first
    const localSnapshot = await this.config.storageAdapter.loadSnapshot(docId);
    const localChanges = await this.config.storageAdapter.loadChangesSince(docId, 0);

    // Try fetching from server
    const serverSnapshot = await this.config.networkAdapter.fetchLatestSnapshot(docId);
    const serverSnapshotVersion = serverSnapshot?.snapshotVersion ?? 0;
    const localSnapshotVersion = localSnapshot?.snapshotVersion ?? 0;

    // Use whichever snapshot is newer
    const snapshot = serverSnapshotVersion > localSnapshotVersion ? serverSnapshot : localSnapshot;

    let session: EncryptedSyncSession<unknown>;

    if (snapshot) {
      session = EncryptedSyncSession.fromSnapshot(
        snapshot,
        keys,
        this.config.sodium,
        snapshot.lastSeq,
      );
      lastSeq = snapshot.lastSeq;

      // Persist server snapshot locally if newer
      if (serverSnapshot && serverSnapshotVersion > localSnapshotVersion) {
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

    // Apply local changes that are after the snapshot
    const changesAfterSnapshot = localChanges.filter((c) => c.seq > lastSeq);
    if (changesAfterSnapshot.length > 0) {
      session.applyEncryptedChanges(changesAfterSnapshot);
      lastSeq = computeMaxSeq(changesAfterSnapshot, lastSeq);
    }

    // Fetch any server changes we don't have
    const serverChanges = await this.config.networkAdapter.fetchChangesSince(docId, lastSeq);
    if (serverChanges.length > 0) {
      session.applyEncryptedChanges(serverChanges);
      for (const change of serverChanges) {
        await this.config.storageAdapter.appendChange(docId, change);
      }
      lastSeq = computeMaxSeq(serverChanges, lastSeq);
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
