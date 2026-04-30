import * as Automerge from "@automerge/automerge";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createJournalDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { getSodium, makeKeys, s } from "./helpers/document-lifecycle-fixtures.js";
import {
  asFrontingSessionId,
  asGroupId,
  asJournalEntryId,
  asSyncDocId,
} from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Section 5: Purging ────────────────────────────────────────────────

describe("Purging: post-compaction state", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys(sodium);
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
      d.entries[asJournalEntryId("entry_1")] = {
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
    const postChange = session.change((d) => {
      d.sessions[asFrontingSessionId("fs_post")] = {
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

    // Snapshot is created but submission/retention logic is out-of-scope (server-side)
    session.createSnapshot(1);

    const env2 = session.change((d) => {
      d.sessions[asFrontingSessionId("fs_2")] = {
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
      d.groups[asGroupId("grp_1")] = {
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
      const g = d.groups[asGroupId("grp_1")];
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

    expect(recovered.document.groups[asGroupId("grp_1")]?.name.val).toBe("Renamed Group");
  });
});
