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
}

/** Internal tracking of per-document sync position. */
interface DocumentState {
  lastSyncedSeq: number;
  lastSnapshotVersion: number;
}

/**
 * Client-side sync engine.
 *
 * Manages the lifecycle of encrypted sync sessions: bootstrap from
 * server manifest, apply remote changes, submit local changes.
 */
export class SyncEngine {
  private readonly sessions = new Map<string, EncryptedSyncSession<unknown>>();
  private readonly syncStates = new Map<string, DocumentState>();
  private readonly subscriptions: Array<{ unsubscribe(): void }> = [];

  private readonly networkAdapter: SyncNetworkAdapter;
  private readonly storageAdapter: SyncStorageAdapter;
  private readonly keyResolver: DocumentKeyResolver;
  private readonly sodium: SodiumAdapter;
  private readonly profile: ReplicationProfile;
  private readonly systemId: string;

  constructor(config: SyncEngineConfig) {
    this.networkAdapter = config.networkAdapter;
    this.storageAdapter = config.storageAdapter;
    this.keyResolver = config.keyResolver;
    this.sodium = config.sodium;
    this.profile = config.profile;
    this.systemId = config.systemId;
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

    // 4. Hydrate each active document
    for (const entry of subscriptionSet.active) {
      await this.hydrateDocument(entry.docId, entry.docType);
    }

    // 5. Subscribe for real-time updates
    for (const entry of subscriptionSet.active) {
      const sub = this.networkAdapter.subscribe(entry.docId, (changes) => {
        void this.handleIncomingChanges(entry.docId, changes);
      });
      this.subscriptions.push(sub);
    }
  }

  // ── Session access ──────────────────────────────────────────────────

  /** Get a hydrated session by document ID. */
  getSession<T>(docId: string): EncryptedSyncSession<T> | undefined {
    return this.sessions.get(docId) as EncryptedSyncSession<T> | undefined;
  }

  /** Get sync state for a document. */
  getSyncState(docId: string): DocumentSyncState | undefined {
    const state = this.syncStates.get(docId);
    if (!state) return undefined;
    return {
      docId,
      lastSyncedSeq: state.lastSyncedSeq,
      lastSnapshotVersion: state.lastSnapshotVersion,
      onDemand: false,
    };
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
    const session = this.sessions.get(docId);
    if (!session) {
      throw new Error(`No active session for document: ${docId}`);
    }

    // Produce encrypted change (no seq yet)
    const envelope = session.change(changeFn);

    // Submit to server — get server-assigned seq
    const sequenced = await this.networkAdapter.submitChange(docId, envelope);

    // Persist locally with server seq
    await this.storageAdapter.appendChange(docId, sequenced);

    // Update sync state
    this.updateSyncState(docId, sequenced.seq);

    return sequenced.seq;
  }

  // ── Steady-state: inbound ──────────────────────────────────────────

  /**
   * Handle incoming changes from server push (DocumentUpdate).
   * Applies to the session and persists locally.
   */
  async handleIncomingChanges(
    docId: string,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void> {
    const session = this.sessions.get(docId);
    if (!session) return;

    // Apply via session (handles dedup, sorting, decryption)
    session.applyEncryptedChanges(changes);

    // Persist each change locally
    for (const change of changes) {
      await this.storageAdapter.appendChange(docId, change);
    }

    // Update sync state to highest seq
    let maxSeq = this.syncStates.get(docId)?.lastSyncedSeq ?? 0;
    for (const change of changes) {
      if (change.seq > maxSeq) {
        maxSeq = change.seq;
      }
    }
    this.updateSyncState(docId, maxSeq);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /** Unsubscribe from all documents and clear sessions. */
  dispose(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.sessions.clear();
    this.syncStates.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────────

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
    let lastSeq = 0;

    if (snapshot) {
      session = EncryptedSyncSession.fromSnapshot(snapshot, keys, this.sodium);
      lastSeq = snapshot.snapshotVersion;

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

    // Apply local changes that are after the snapshot
    if (localChanges.length > 0) {
      const changesAfterSnapshot = localChanges.filter((c) => c.seq > lastSeq);
      if (changesAfterSnapshot.length > 0) {
        session.applyEncryptedChanges(changesAfterSnapshot);
        lastSeq = Math.max(lastSeq, ...changesAfterSnapshot.map((c) => c.seq));
      }
    }

    // Fetch any server changes we don't have
    const serverChanges = await this.networkAdapter.fetchChangesSince(docId, lastSeq);
    if (serverChanges.length > 0) {
      session.applyEncryptedChanges(serverChanges);
      for (const change of serverChanges) {
        await this.storageAdapter.appendChange(docId, change);
      }
      lastSeq = Math.max(lastSeq, ...serverChanges.map((c) => c.seq));
    }

    this.sessions.set(docId, session);
    this.syncStates.set(docId, {
      lastSyncedSeq: lastSeq,
      lastSnapshotVersion: snapshot?.snapshotVersion ?? 0,
    });
  }

  private updateSyncState(docId: string, seq: number): void {
    const existing = this.syncStates.get(docId);
    this.syncStates.set(docId, {
      lastSyncedSeq: seq,
      lastSnapshotVersion: existing?.lastSnapshotVersion ?? 0,
    });
  }
}
