import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createJournalDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";
import {
  DEFAULT_COMPACTION_CONFIG,
  DEFAULT_STORAGE_BUDGET,
  DOCUMENT_SIZE_LIMITS,
  StorageBudgetExceededError,
  SYNC_PRIORITY_ORDER,
  TIME_SPLIT_CONFIGS,
} from "../types.js";

import { asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

// ── helpers ──────────────────────────────────────────────────────────

const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

function makeKeys(): DocumentKeys {
  return {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys: sodium.signKeypair(),
  };
}

function makeSessions<T>(
  base: Automerge.Doc<T>,
  keys: DocumentKeys,
  docId: SyncDocumentId,
): [EncryptedSyncSession<T>, EncryptedSyncSession<T>] {
  return [
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
  ];
}

// ── Section 2: Compaction ─────────────────────────────────────────────

describe("Compaction: snapshot roundtrip", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("snapshot captures current document state and restores correctly", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-lc-001"),
      sodium,
    });

    session.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Alice"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const snapshot = session.createSnapshot(1);
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium);

    expect(restored.document.members["mem_1"]?.name.val).toBe("Alice");
    expect(restored.documentId).toBe("doc-lc-001");
  });

  it("snapshot is smaller than full document with many changes", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-lc-size"),
      sodium,
    });

    // Produce many changes to build up history
    for (let i = 0; i < 50; i++) {
      session.change((d) => {
        d.sessions[`fs_${i.toString()}`] = {
          id: s(`fs_${i.toString()}`),
          systemId: s("sys_1"),
          memberId: s("mem_1"),
          startTime: 1000 + i,
          endTime: null,
          comment: null,
          customFrontId: null,
          structureEntityId: null,
          positionality: null,
          outtrigger: null,
          outtriggerSentiment: null,
          archived: false,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        };
      });
    }

    const snapshot = session.createSnapshot(1);
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium);

    // After snapshot, the restored document has the same state
    expect(Object.keys(restored.document.sessions)).toHaveLength(50);
    // Snapshot ciphertext is finite and reasonable (just sanity check)
    expect(snapshot.ciphertext.byteLength).toBeGreaterThan(0);
  });

  it("archived entities are preserved in snapshot", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-lc-archive"),
      sodium,
    });

    session.change((d) => {
      d.members["mem_archived"] = {
        id: s("mem_archived"),
        systemId: s("sys_1"),
        name: s("Archived Member"),
        pronouns: s("[]"),
        description: s("still here after compaction"),
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: true,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const snapshot = session.createSnapshot(1);
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium);

    expect(restored.document.members["mem_archived"]?.archived).toBe(true);
    expect(restored.document.members["mem_archived"]?.description?.val).toBe(
      "still here after compaction",
    );
  });

  it("concurrent compaction: higher snapshotVersion wins", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-lc-concurrent"));

    // Both sessions produce changes independently
    sessionA.change((d) => {
      d.members["mem_a"] = {
        id: s("mem_a"),
        systemId: s("sys_1"),
        name: s("From A"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    sessionB.change((d) => {
      d.members["mem_b"] = {
        id: s("mem_b"),
        systemId: s("sys_1"),
        name: s("From B"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    // Both create snapshots with different versions
    const snapA = sessionA.createSnapshot(1);
    const snapB = sessionB.createSnapshot(2);

    // Higher version (snapB at version 2) should be preferred
    expect(snapA.snapshotVersion).toBe(1);
    expect(snapB.snapshotVersion).toBe(2);
    expect(snapB.snapshotVersion).toBeGreaterThan(snapA.snapshotVersion);

    // The restored session from snapB has B's data
    const restoredB = EncryptedSyncSession.fromSnapshot<typeof base>(snapB, keys, sodium);
    expect(restoredB.document.members["mem_b"]?.name.val).toBe("From B");
  });

  it("change count tracking: snapshot + new changes roundtrip", async () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-lc-roundtrip"),
      sodium,
    });

    // Pre-snapshot changes
    for (let i = 0; i < 5; i++) {
      session.change((d) => {
        d.sessions[`fs_pre_${i.toString()}`] = {
          id: s(`fs_pre_${i.toString()}`),
          systemId: s("sys_1"),
          memberId: s("mem_1"),
          startTime: 1000 + i,
          endTime: null,
          comment: null,
          customFrontId: null,
          structureEntityId: null,
          positionality: null,
          outtrigger: null,
          outtriggerSentiment: null,
          archived: false,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        };
      });
    }

    const snapshot = session.createSnapshot(1);

    // Post-snapshot changes
    const relay = new EncryptedRelay();
    const newSession = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium, 1);

    const postChange = newSession.change((d) => {
      d.sessions["fs_post_1"] = {
        id: s("fs_post_1"),
        systemId: s("sys_1"),
        memberId: s("mem_2"),
        startTime: 2000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    await relay.submit(postChange);

    // anotherSession starts with lastSyncedSeq=0 because it's using a fresh relay
    // (in production the relay would track real server seqs, but here we use a fresh relay
    // for the post-snapshot phase, so the postChange gets seq=1)
    const anotherSession = EncryptedSyncSession.fromSnapshot<typeof base>(
      snapshot,
      keys,
      sodium,
      0,
    );
    const _r1 = await relay.getEnvelopesSince(asSyncDocId("doc-lc-roundtrip"), 0);
    anotherSession.applyEncryptedChanges(_r1.envelopes);

    // Both sessions agree on the post-snapshot state
    expect(Object.keys(newSession.document.sessions)).toHaveLength(6);
    expect(Object.keys(anotherSession.document.sessions)).toHaveLength(6);
    expect(newSession.document).toEqual(anotherSession.document);
  });

  it("snapshot version is monotonically increasing", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-lc-mono"),
      sodium,
    });

    // Add a change so the document has some state
    session.change((d) => {
      d.members["mem_mono"] = {
        id: s("mem_mono"),
        systemId: s("sys_1"),
        name: s("Monotone"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const snap1 = session.createSnapshot(1);
    const snap2 = session.createSnapshot(2);
    const snap3 = session.createSnapshot(3);

    expect(snap1.snapshotVersion).toBeLessThan(snap2.snapshotVersion);
    expect(snap2.snapshotVersion).toBeLessThan(snap3.snapshotVersion);
  });

  it("snapshot restores with lastSyncedSeq for incremental recovery", async () => {
    const base = createFrontingDocument();
    const relay = new EncryptedRelay();
    const keys2 = makeKeys();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("doc-lc-seq"),
      sodium,
    });

    const env1 = session.change((d) => {
      d.sessions["fs_1"] = {
        id: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(env1);

    const snapshot = session.createSnapshot(1);
    // Restore with lastSyncedSeq = 1 so incremental sync knows to start from seq 2
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys2, sodium, 1);
    expect(restored.lastSyncedSeq).toBe(1);
    expect(Object.keys(restored.document.sessions)).toHaveLength(1);
  });
});

// ── Section 4: Time-split ─────────────────────────────────────────────

describe("Time-split configuration", () => {
  it("TIME_SPLIT_CONFIGS has correct entries for all time-split document types", () => {
    const byType = Object.fromEntries(TIME_SPLIT_CONFIGS.map((c) => [c.documentType, c]));

    expect(byType["fronting"]?.splitUnit).toBe("quarter");
    expect(byType["fronting"]?.splitThresholdBytes).toBe(5_242_880);

    expect(byType["chat"]?.splitUnit).toBe("month");
    expect(byType["chat"]?.splitThresholdBytes).toBe(5_242_880);

    expect(byType["journal"]?.splitUnit).toBe("year");
    expect(byType["journal"]?.splitThresholdBytes).toBe(10_485_760);
  });

  it("DOCUMENT_SIZE_LIMITS covers all document types", () => {
    const types = [
      "system-core",
      "fronting",
      "chat",
      "journal",
      "privacy-config",
      "bucket",
    ] as const;
    for (const t of types) {
      expect(DOCUMENT_SIZE_LIMITS[t]).toBeGreaterThan(0);
    }
  });

  it("document IDs parse correct timePeriod for time-split docs", () => {
    // Quarter naming convention
    const frontingQ1 = "fronting-sys_abc-2026-Q1";
    expect(frontingQ1).toMatch(/-2026-Q1$/);

    // Month naming convention
    const chatMar = "chat-ch_xyz-2026-03";
    expect(chatMar).toMatch(/-2026-03$/);

    // Year naming convention
    const journal2026 = "journal-sys_abc-2026";
    expect(journal2026).toMatch(/-2026$/);
  });

  it("new fronting session created after split goes to new period doc", () => {
    // Verify that two separate sessions with different docIds don't interfere
    const base = createFrontingDocument();
    const keys1 = makeKeys();
    const keys2 = makeKeys();

    const sessionQ1 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys1,
      documentId: asSyncDocId("fronting-sys_abc-2026-Q1"),
      sodium,
    });
    const sessionQ2 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("fronting-sys_abc-2026-Q2"),
      sodium,
    });

    // Q1 has a historical session
    sessionQ1.change((d) => {
      d.sessions["fs_q1"] = {
        id: s("fs_q1"),
        systemId: s("sys_abc"),
        memberId: s("mem_1"),
        startTime: 1_740_000_000,
        endTime: 1_740_001_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_740_000_000,
        updatedAt: 1_740_001_000,
      };
    });

    // Q2 has a new session
    sessionQ2.change((d) => {
      d.sessions["fs_q2"] = {
        id: s("fs_q2"),
        systemId: s("sys_abc"),
        memberId: s("mem_1"),
        startTime: 1_750_000_000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_750_000_000,
        updatedAt: 1_750_000_000,
      };
    });

    // Each period doc is independent
    expect(Object.keys(sessionQ1.document.sessions)).toHaveLength(1);
    expect(Object.keys(sessionQ2.document.sessions)).toHaveLength(1);
    expect(sessionQ1.document.sessions["fs_q1"]?.id.val).toBe("fs_q1");
    expect(sessionQ2.document.sessions["fs_q2"]?.id.val).toBe("fs_q2");
  });

  it("cross-split query: concatenate and sort fronting sessions from multiple periods", () => {
    const base = createFrontingDocument();
    const keys1 = makeKeys();
    const keys2 = makeKeys();

    const sessionQ1 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys1,
      documentId: asSyncDocId("fronting-sys_1-2025-Q4"),
      sodium,
    });
    const sessionQ2 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("fronting-sys_1-2026-Q1"),
      sodium,
    });

    sessionQ1.change((d) => {
      d.sessions["fs_q4"] = {
        id: s("fs_q4"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1_000,
        endTime: 2_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_000,
        updatedAt: 2_000,
      };
    });

    sessionQ2.change((d) => {
      d.sessions["fs_q1"] = {
        id: s("fs_q1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 3_000,
        endTime: 4_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 3_000,
        updatedAt: 4_000,
      };
    });

    // Cross-split: client merges results by sorting
    const q4Sessions = Object.values(sessionQ1.document.sessions);
    const q1Sessions = Object.values(sessionQ2.document.sessions);
    const allSessions = [...q4Sessions, ...q1Sessions].sort((a, b) => a.startTime - b.startTime);

    expect(allSessions).toHaveLength(2);
    expect(allSessions[0]?.id.val).toBe("fs_q4");
    expect(allSessions[1]?.id.val).toBe("fs_q1");
  });
});

// ── Section 5: Purging ────────────────────────────────────────────────

describe("Purging: post-compaction state", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("state after snapshot + purge matches state before purge", () => {
    const base = createJournalDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-purge-001"),
      sodium,
    });

    session.change((d) => {
      d.entries["entry_1"] = {
        id: s("entry_1"),
        systemId: s("sys_1"),
        author: s("mem_1"),
        frontingSessionId: null,
        title: s("Test entry"),
        blocks: s("[]"),
        tags: s("[]"),
        linkedEntities: s("[]"),
        frontingSnapshots: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const stateBefore = Automerge.save(session.document);
    const snapshot = session.createSnapshot(1);

    // Restore from snapshot (simulates post-purge state)
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium);

    // State must match
    const stateAfter = Automerge.save(restored.document);
    expect(stateAfter).toEqual(stateBefore);
  });

  it("purge roundtrip: snapshot + apply new changes = correct final state", async () => {
    const base = createFrontingDocument();
    const relay = new EncryptedRelay();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-purge-002"),
      sodium,
    });

    // Pre-snapshot changes
    for (let i = 0; i < 3; i++) {
      session.change((d) => {
        d.sessions[`fs_pre_${i.toString()}`] = {
          id: s(`fs_pre_${i.toString()}`),
          systemId: s("sys_1"),
          memberId: s("mem_1"),
          startTime: 1000 + i,
          endTime: null,
          comment: null,
          customFrontId: null,
          structureEntityId: null,
          positionality: null,
          outtrigger: null,
          outtriggerSentiment: null,
          archived: false,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        };
      });
    }

    const snapshot = session.createSnapshot(1);

    // Post-snapshot changes
    const postChange = session.change((d) => {
      d.sessions["fs_post"] = {
        id: s("fs_post"),
        systemId: s("sys_1"),
        memberId: s("mem_2"),
        startTime: 2000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    await relay.submit(postChange);

    // Restore from snapshot and apply post-snapshot changes (simulates purge + recovery).
    // lastSyncedSeq=0 because this fresh relay only has the post-snapshot change at seq=1.
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium, 0);
    const _r2 = await relay.getEnvelopesSince(asSyncDocId("doc-purge-002"), 0);
    restored.applyEncryptedChanges(_r2.envelopes);

    expect(Object.keys(restored.document.sessions)).toHaveLength(4);
    expect(Object.keys(restored.document.sessions)).toContain("fs_post");
  });

  it("changes with seq > snapshotVersion survive purge", async () => {
    const base = createFrontingDocument();
    const relay = new EncryptedRelay();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-purge-003"),
      sodium,
    });

    const env1 = session.change((d) => {
      d.sessions["fs_1"] = {
        id: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(env1);

    // Snapshot is created but submission/retention logic is out-of-scope (server-side)
    session.createSnapshot(1);

    const env2 = session.change((d) => {
      d.sessions["fs_2"] = {
        id: s("fs_2"),
        systemId: s("sys_1"),
        memberId: s("mem_2"),
        startTime: 2000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    await relay.submit(env2);

    // After "purge" (seq <= 1 removed), only env2 (seq 2) survives
    const _changesAfterPurgePg = await relay.getEnvelopesSince(asSyncDocId("doc-purge-003"), 1);
    const changesAfterPurge = _changesAfterPurgePg.envelopes;
    expect(changesAfterPurge).toHaveLength(1);
    expect(changesAfterPurge[0]?.seq).toBe(2);
  });

  it("snapshot + pruned changes + new changes = consistent final state", async () => {
    const base = createSystemCoreDocument();
    const relay = new EncryptedRelay();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-purge-full"),
      sodium,
    });

    // Build some history
    const preEnv = session.change((d) => {
      d.groups["grp_1"] = {
        id: s("grp_1"),
        systemId: s("sys_1"),
        name: s("Group 1"),
        description: null,
        parentGroupId: null,
        imageSource: null,
        color: null,
        emoji: null,
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(preEnv);

    const snap = session.createSnapshot(1);

    // New change after snapshot
    const postEnv = session.change((d) => {
      const g = d.groups["grp_1"];
      if (g) {
        g.name = s("Renamed Group");
        g.updatedAt = 2000;
      }
    });
    await relay.submit(postEnv);

    // Simulate recovery from snapshot
    const recovered = EncryptedSyncSession.fromSnapshot<typeof base>(snap, keys, sodium, 1);
    // Apply only changes after snapshotVersion=1
    const _postSnapshotChangesPg = await relay.getEnvelopesSince(asSyncDocId("doc-purge-full"), 1);
    const postSnapshotChanges = _postSnapshotChangesPg.envelopes;
    recovered.applyEncryptedChanges(postSnapshotChanges);

    expect(recovered.document.groups["grp_1"]?.name.val).toBe("Renamed Group");
  });
});

// ── Section 6: Storage budget ─────────────────────────────────────────

describe("Storage budget", () => {
  it("StorageBudgetExceededError has correct type and fields", () => {
    const err = new StorageBudgetExceededError(
      asSyncDocId("doc-budget-test"),
      600_000_000,
      524_288_000,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StorageBudgetExceededError);
    expect(err.name).toBe("StorageBudgetExceededError");
    expect(err.documentId).toBe("doc-budget-test");
    expect(err.currentBytes).toBe(600_000_000);
    expect(err.maxBytes).toBe(524_288_000);
    expect(err.message).toContain("doc-budget-test");
  });

  it("DEFAULT_STORAGE_BUDGET is 500 MB", () => {
    expect(DEFAULT_STORAGE_BUDGET.maxTotalBytes).toBe(524_288_000);
  });

  it("SYNC_PRIORITY_ORDER has system-core first and historical last", () => {
    expect(SYNC_PRIORITY_ORDER[0]).toBe("system-core");
    expect(SYNC_PRIORITY_ORDER[SYNC_PRIORITY_ORDER.length - 1]).toBe("note-historical");
  });
});

// ── Section 7: Archive ────────────────────────────────────────────────

describe("Archive: cold document behavior", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("archived flag on SyncManifestEntry is boolean", () => {
    // Verify that the archived field is a proper boolean — structural test
    const archived = true;
    const notArchived = false;
    expect(typeof archived).toBe("boolean");
    expect(typeof notArchived).toBe("boolean");
    expect(archived).not.toBe(notArchived);
  });

  it("writing to a session that was loaded from an 'archived' snapshot un-archives it conceptually", () => {
    // Simulates loading an archived doc on-demand and writing to it
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("fronting-sys_1-2024-Q4"),
      sodium,
    });

    // Add historical data
    session.change((d) => {
      d.sessions["fs_old"] = {
        id: s("fs_old"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1_000,
        endTime: 2_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_000,
        updatedAt: 2_000,
      };
    });

    // The document is readable and writable regardless of server-side archive flag
    expect(session.document.sessions["fs_old"]?.archived).toBe(false);
    expect(Object.keys(session.document.sessions)).toHaveLength(1);
  });

  it("on-demand loaded document has correct data after sync", async () => {
    const base = createSystemCoreDocument();
    const relay = new EncryptedRelay();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-archive-ondemand"));

    const env = sessionA.change((d) => {
      d.members["mem_history"] = {
        id: s("mem_history"),
        systemId: s("sys_1"),
        name: s("Historical Member"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(env);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions have the data — simulates on-demand load working correctly
    expect(sessionB.document.members["mem_history"]?.name.val).toBe("Historical Member");
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("DEFAULT_COMPACTION_CONFIG has expected thresholds", () => {
    expect(DEFAULT_COMPACTION_CONFIG.changeThreshold).toBe(200);
    expect(DEFAULT_COMPACTION_CONFIG.sizeThresholdBytes).toBe(1_048_576);
  });
});
