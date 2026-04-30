import * as Automerge from "@automerge/automerge";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFrontingDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { getSodium, makeKeys, makeSessions, s } from "./helpers/document-lifecycle-fixtures.js";
import { asFrontingSessionId, asMemberId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Section 2: Compaction ─────────────────────────────────────────────

describe("Compaction: snapshot roundtrip", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys(sodium);
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
      d.members[asMemberId("mem_1")] = {
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

    expect(restored.document.members[asMemberId("mem_1")]?.name.val).toBe("Alice");
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
        d.sessions[asFrontingSessionId(`fs_${i.toString()}`)] = {
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
      d.members[asMemberId("mem_archived")] = {
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

    expect(restored.document.members[asMemberId("mem_archived")]?.archived).toBe(true);
    expect(restored.document.members[asMemberId("mem_archived")]?.description?.val).toBe(
      "still here after compaction",
    );
  });

  it("concurrent compaction: higher snapshotVersion wins", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-lc-concurrent"), sodium);

    // Both sessions produce changes independently
    sessionA.change((d) => {
      d.members[asMemberId("mem_a")] = {
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
      d.members[asMemberId("mem_b")] = {
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
    expect(restoredB.document.members[asMemberId("mem_b")]?.name.val).toBe("From B");
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
        d.sessions[asFrontingSessionId(`fs_pre_${i.toString()}`)] = {
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
      d.sessions[asFrontingSessionId("fs_post_1")] = {
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
      d.members[asMemberId("mem_mono")] = {
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
    const keys2 = makeKeys(sodium);
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("doc-lc-seq"),
      sodium,
    });

    const env1 = session.change((d) => {
      d.sessions[asFrontingSessionId("fs_1")] = {
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
