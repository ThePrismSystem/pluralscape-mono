import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { requestOnDemandDocument } from "../on-demand-loader.js";
import { EncryptedSyncSession } from "../sync-session.js";

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
    return Promise.resolve({ systemId, documents: [] });
  }
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

describe("requestOnDemandDocument", () => {
  const DOC_ID = "fronting-sys_test";
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
});
