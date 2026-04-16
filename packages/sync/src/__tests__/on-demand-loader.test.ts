import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OnDemandLoader, requestOnDemandDocument } from "../on-demand-loader.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { asSyncDocId, sysId } from "./test-crypto-helpers.js";

import type {
  SyncManifest,
  SyncNetworkAdapter,
  SyncSubscription,
} from "../adapters/network-adapter.js";
import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

type SimpleDoc = { items: string[] };

let sodium: SodiumAdapter;

function makeKeys(s: SodiumAdapter): DocumentKeys {
  return {
    encryptionKey: s.aeadKeygen(),
    signingKeys: s.signKeypair(),
  };
}

// ── OnDemandLoader (lastFetchedSeq tracking) ────────────────────────

describe("OnDemandLoader", () => {
  const DOC_ID = asSyncDocId("fronting-sys_loader");
  let keys: DocumentKeys;

  beforeAll(async () => {
    sodium = new WasmSodiumAdapter();
    await sodium.init();
  });

  beforeEach(() => {
    keys = makeKeys(sodium);
  });

  it("uses lastFetchedSeq on subsequent loads to skip already-fetched changes", async () => {
    const fetchChangesSince = vi.fn().mockResolvedValue([]);
    const mockAdapter: SyncNetworkAdapter = {
      fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
      fetchChangesSince,
      submitChange: vi.fn(),
      submitSnapshot: vi.fn(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      fetchManifest: vi.fn().mockResolvedValue({ systemId: sysId("sys_1"), documents: [] }),
    };

    const loader = new OnDemandLoader();

    // First load: no prior seq tracked, should fetch from 0
    await loader.load<SimpleDoc>({ docId: DOC_ID, persist: false }, mockAdapter, keys, sodium);
    expect(fetchChangesSince).toHaveBeenCalledWith(DOC_ID, 0);

    // Simulate a second load where the adapter returns a change with seq=5
    const base = Automerge.from<SimpleDoc>({ items: [] });
    const session = new EncryptedSyncSession<SimpleDoc>({
      doc: base,
      keys,
      documentId: DOC_ID,
      sodium,
    });
    const env = session.change((doc) => {
      doc.items.push("new-item");
    });
    fetchChangesSince.mockResolvedValue([{ ...env, seq: 5 }]);

    const result = await loader.load<SimpleDoc>(
      { docId: DOC_ID, persist: false },
      mockAdapter,
      keys,
      sodium,
    );

    // Second load still fetches from 0 because first load returned seq=0
    expect(fetchChangesSince).toHaveBeenNthCalledWith(2, DOC_ID, 0);

    // After second load, lastFetchedSeq should be updated to 5
    expect(loader.getLastFetchedSeq(DOC_ID)).toBe(5);
    expect(result.syncState.lastSyncedSeq).toBe(5);

    // Third load: should fetch from 5 (tracked seq)
    fetchChangesSince.mockResolvedValue([]);
    await loader.load<SimpleDoc>({ docId: DOC_ID, persist: false }, mockAdapter, keys, sodium);
    expect(fetchChangesSince).toHaveBeenNthCalledWith(3, DOC_ID, 5);
  });

  it("returns 0 for never-fetched documents", () => {
    const loader = new OnDemandLoader();
    expect(loader.getLastFetchedSeq(DOC_ID)).toBe(0);
  });

  it("clear resets all tracked state", async () => {
    const mockAdapter: SyncNetworkAdapter = {
      fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
      fetchChangesSince: vi.fn().mockResolvedValue([]),
      submitChange: vi.fn(),
      submitSnapshot: vi.fn(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      fetchManifest: vi.fn().mockResolvedValue({ systemId: sysId("sys_1"), documents: [] }),
    };

    const loader = new OnDemandLoader();
    await loader.load<SimpleDoc>({ docId: DOC_ID, persist: false }, mockAdapter, keys, sodium);

    loader.clear();
    expect(loader.getLastFetchedSeq(DOC_ID)).toBe(0);
  });
});

/** Minimal mock adapter for on-demand loading tests. */
class MockNetworkAdapter implements SyncNetworkAdapter {
  private snapshots = new Map<string, EncryptedSnapshotEnvelope>();
  private changes = new Map<string, EncryptedChangeEnvelope[]>();

  setSnapshot(docId: string, snapshot: EncryptedSnapshotEnvelope): void {
    this.snapshots.set(docId, snapshot);
  }

  addChange(docId: string, envelope: EncryptedChangeEnvelope): void {
    const existing = this.changes.get(docId) ?? [];
    existing.push(envelope);
    this.changes.set(docId, existing);
  }

  fetchLatestSnapshot(docId: string): Promise<EncryptedSnapshotEnvelope | null> {
    return Promise.resolve(this.snapshots.get(docId) ?? null);
  }

  fetchChangesSince(docId: string, sinceSeq: number): Promise<readonly EncryptedChangeEnvelope[]> {
    const all = this.changes.get(docId) ?? [];
    return Promise.resolve(all.filter((e) => e.seq > sinceSeq));
  }

  submitChange(
    docId: string,
    change: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<EncryptedChangeEnvelope> {
    void docId;
    void change;
    return Promise.reject(new Error("Not implemented in mock"));
  }

  submitSnapshot(docId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    void docId;
    void snapshot;
    return Promise.reject(new Error("Not implemented in mock"));
  }

  subscribe(
    docId: string,
    onChanges: (changes: readonly EncryptedChangeEnvelope[]) => void,
  ): SyncSubscription {
    void docId;
    void onChanges;
    return { unsubscribe: () => undefined };
  }

  fetchManifest(systemId: string): Promise<SyncManifest> {
    return Promise.resolve({ systemId: sysId(systemId), documents: [] });
  }
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

describe("requestOnDemandDocument", () => {
  const DOC_ID = asSyncDocId("fronting-sys_test");
  let keys: DocumentKeys;
  let adapter: MockNetworkAdapter;

  beforeEach(() => {
    keys = makeKeys(sodium);
    adapter = new MockNetworkAdapter();
  });

  it("loads from snapshot and applies subsequent changes", async () => {
    // Create a session, make changes, snapshot, then make more changes
    const base = Automerge.from<SimpleDoc>({ items: [] });
    const session = new EncryptedSyncSession<SimpleDoc>({
      doc: base,
      keys,
      documentId: DOC_ID,
      sodium,
    });

    session.change((doc) => {
      doc.items.push("before-snapshot");
    });

    const snapshot = session.createSnapshot(1);
    adapter.setSnapshot(DOC_ID, snapshot);

    // Add a change after the snapshot
    const changeEnvelope = session.change((doc) => {
      doc.items.push("after-snapshot");
    });
    adapter.addChange(DOC_ID, { ...changeEnvelope, seq: 1 });

    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: DOC_ID, persist: true },
      adapter,
      keys,
      sodium,
    );

    expect(result.session.document.items).toContain("before-snapshot");
    expect(result.session.document.items).toContain("after-snapshot");
    expect(result.syncState.lastSnapshotVersion).toBe(1);
    expect(result.syncState.lastSyncedSeq).toBe(1);
  });

  it("loads fresh doc when no snapshot exists", async () => {
    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: DOC_ID, persist: false },
      adapter,
      keys,
      sodium,
    );

    expect(result.session.documentId).toBe(DOC_ID);
    expect(result.syncState.lastSnapshotVersion).toBe(0);
    expect(result.syncState.lastSyncedSeq).toBe(0);
  });

  it("returns correct DocumentSyncState with onDemand: true", async () => {
    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: DOC_ID, persist: true },
      adapter,
      keys,
      sodium,
    );

    expect(result.syncState).toEqual({
      docId: DOC_ID,
      lastSyncedSeq: 0,
      lastSnapshotVersion: 0,
      onDemand: true,
    });
  });

  it("applies changes from adapter to snapshot-loaded session", async () => {
    const base = Automerge.from<SimpleDoc>({ items: [] });
    const session = new EncryptedSyncSession<SimpleDoc>({
      doc: base,
      keys,
      documentId: DOC_ID,
      sodium,
    });

    const snapshot = session.createSnapshot(3);
    adapter.setSnapshot(DOC_ID, snapshot);

    // Two changes after snapshot
    const env1 = session.change((doc) => {
      doc.items.push("change-1");
    });
    adapter.addChange(DOC_ID, { ...env1, seq: 1 });

    const env2 = session.change((doc) => {
      doc.items.push("change-2");
    });
    adapter.addChange(DOC_ID, { ...env2, seq: 2 });

    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: DOC_ID, persist: true },
      adapter,
      keys,
      sodium,
    );

    expect(result.session.document.items).toEqual(["change-1", "change-2"]);
    expect(result.syncState.lastSyncedSeq).toBe(2);
    expect(result.syncState.lastSnapshotVersion).toBe(3);
  });

  it("snapshot + overlapping changes produce correct state (idempotent)", async () => {
    const base = Automerge.from<SimpleDoc>({ items: [] });
    const session = new EncryptedSyncSession<SimpleDoc>({
      doc: base,
      keys,
      documentId: DOC_ID,
      sodium,
    });

    // Make a change, then snapshot (snapshot includes the change)
    const env1 = session.change((doc) => {
      doc.items.push("item-1");
    });
    const snapshot = session.createSnapshot(1);
    adapter.setSnapshot(DOC_ID, snapshot);

    // Also provide the same change via fetchChangesSince (overlap)
    adapter.addChange(DOC_ID, { ...env1, seq: 1 });

    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: DOC_ID, persist: true },
      adapter,
      keys,
      sodium,
    );

    // "item-1" should appear exactly once — Automerge dedupes by hash
    expect(result.session.document.items).toEqual(["item-1"]);
  });

  it("propagates fetchLatestSnapshot errors", async () => {
    const failAdapter = new MockNetworkAdapter();
    failAdapter.fetchLatestSnapshot = () => Promise.reject(new Error("snapshot fetch failed"));

    await expect(
      requestOnDemandDocument<SimpleDoc>(
        { docId: DOC_ID, persist: true },
        failAdapter,
        keys,
        sodium,
      ),
    ).rejects.toThrow("snapshot fetch failed");
  });

  it("propagates fetchChangesSince errors", async () => {
    const failAdapter = new MockNetworkAdapter();
    failAdapter.fetchChangesSince = () => Promise.reject(new Error("changes fetch failed"));

    await expect(
      requestOnDemandDocument<SimpleDoc>(
        { docId: DOC_ID, persist: true },
        failAdapter,
        keys,
        sodium,
      ),
    ).rejects.toThrow("changes fetch failed");
  });

  it("creates fresh session for non-fronting document type", async () => {
    const chatDocId = asSyncDocId("chat-ch_test");
    const result = await requestOnDemandDocument<SimpleDoc>(
      { docId: chatDocId, persist: false },
      adapter,
      keys,
      sodium,
    );

    expect(result.session.documentId).toBe(chatDocId);
    expect(result.syncState.lastSnapshotVersion).toBe(0);
    expect(result.syncState.onDemand).toBe(true);
  });
});
