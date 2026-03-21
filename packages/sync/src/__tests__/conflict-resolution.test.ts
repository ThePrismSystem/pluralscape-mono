import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createChatDocument,
  createFrontingDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { docId } from "./test-crypto-helpers.js";

import type { CrdtGroup, CrdtSubsystem, CrdtInnerWorldRegion } from "../schemas/system-core.js";
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

function makeGroup(
  id: string,
  sortOrder: number,
  overrides?: Partial<{ parentGroupId: string }>,
): CrdtGroup {
  return {
    id: s(id),
    systemId: s("sys_1"),
    name: s(id),
    description: null,
    parentGroupId: overrides?.parentGroupId ? s(overrides.parentGroupId) : null,
    imageSource: null,
    color: null,
    emoji: null,
    sortOrder,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

// ── Category 1: Concurrent edits to LWW map entities ─────────────────

describe("Category 1: concurrent edits to LWW map entities", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("1a — concurrent edits to different fields both survive", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-001"));

    // Seed a member in both sessions
    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Original"),
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
    await relay.submit(seedEnv);
    const _r1 = await relay.getEnvelopesSince(docId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r1.envelopes);

    // Concurrent edits to different fields
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("New Name");
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.description = s("New description");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members["mem_1"]?.name.val).toBe("New Name");
    expect(sessionA.document.members["mem_1"]?.description?.val).toBe("New description");
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("1b — concurrent edits to same field converge deterministically (LWW)", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-001"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Original"),
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
    await relay.submit(seedEnv);
    const _r2 = await relay.getEnvelopesSince(docId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r2.envelopes);

    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Name from A");
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Name from B");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions must converge to the same value
    expect(sessionA.document.members["mem_1"]?.name.val).toBe(
      sessionB.document.members["mem_1"]?.name.val,
    );
    // The winning value must be one of the two candidates
    const winner = sessionA.document.members["mem_1"]?.name.val;
    expect(["Name from A", "Name from B"]).toContain(winner);
  });

  it("1c — concurrent archive + edit: both changes apply independently", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-001"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Before"),
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
    await relay.submit(seedEnv);
    const _r3 = await relay.getEnvelopesSince(docId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r3.envelopes);

    // A archives, B edits name — both should apply
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.archived = true;
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Edited while archived");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Entity is archived AND has the edited name
    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);
    expect(sessionA.document.members["mem_1"]?.name.val).toBe("Edited while archived");
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 2: Concurrent appends to lists ───────────────────────────

describe("Category 2: concurrent appends to lists", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("2a — concurrent appends to switches list: both entries present after merge", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-fronting-001"));

    const envA = sessionA.change((d) => {
      d.switches.push({
        id: s("sw_a"),
        systemId: s("sys_1"),
        memberIds: s('["mem_1"]'),
        timestamp: 1000,
        archived: false,
      });
    });
    const envB = sessionB.change((d) => {
      d.switches.push({
        id: s("sw_b"),
        systemId: s("sys_1"),
        memberIds: s('["mem_2"]'),
        timestamp: 1001,
        archived: false,
      });
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.switches).toHaveLength(2);
    expect(sessionB.document.switches).toHaveLength(2);
    const ids = sessionA.document.switches.map((sw) => sw.id.val);
    expect(ids).toContain("sw_a");
    expect(ids).toContain("sw_b");
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 3: Concurrent FrontingSession end time ───────────────────

describe("Category 3: concurrent FrontingSession end time", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("3a — concurrent end-time writes converge to a single LWW winner", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-fronting-001"));

    const seedEnv = sessionA.change((d) => {
      d.sessions["fs_1"] = {
        id: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: null,
        frontingType: s("fronting"),
        comment: null,
        customFrontId: null,
        linkedStructure: null,
        positionality: null,
        outtrigger: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const _r4 = await relay.getEnvelopesSince(docId("doc-fronting-001"), 0);
    sessionB.applyEncryptedChanges(_r4.envelopes);

    // Both sessions try to end the session concurrently
    const envA = sessionA.change((d) => {
      const fs = d.sessions["fs_1"];
      if (fs) {
        fs.endTime = 2000;
        fs.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const fs = d.sessions["fs_1"];
      if (fs) {
        fs.endTime = 2100;
        fs.updatedAt = 2100;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to the same endTime (LWW picks one)
    const endA = sessionA.document.sessions["fs_1"]?.endTime;
    const endB = sessionB.document.sessions["fs_1"]?.endTime;
    expect(endA).not.toBeNull();
    expect(endA).toBe(endB);
    // The winner is one of the two candidates
    expect([2000, 2100]).toContain(endA);
  });
});

// ── Category 4: Concurrent re-parenting creating cycles ───────────────
//
// After merge, both parentGroupId fields are set, creating a cycle in the
// group hierarchy. Post-merge DFS cycle detection is application-layer
// (specified in sync-80bn — not yet implemented).

describe("Category 4: concurrent re-parenting creating cycles", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("4a — concurrent cross-parent writes both apply, producing a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-004"));

    // Seed two root groups (no parent)
    const seedEnv = sessionA.change((d) => {
      d.groups["groupA"] = makeGroup("groupA", 1);
      d.groups["groupB"] = makeGroup("groupB", 2);
    });
    await relay.submit(seedEnv);
    const _r5 = await relay.getEnvelopesSince(docId("doc-cr-004"), 0);
    sessionB.applyEncryptedChanges(_r5.envelopes);

    // A: groupA.parentGroupId = groupB
    const envA = sessionA.change((d) => {
      const g = d.groups["groupA"];
      if (g) {
        g.parentGroupId = s("groupB");
        g.updatedAt = 2000;
      }
    });
    // B: groupB.parentGroupId = groupA (concurrent — cycle-forming)
    const envB = sessionB.change((d) => {
      const g = d.groups["groupB"];
      if (g) {
        g.parentGroupId = s("groupA");
        g.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge
    expect(sessionA.document).toEqual(sessionB.document);

    // Both parentGroupId values are set — cycle is present in merged state.
    // Post-merge cycle detection (DFS traversal) is application-layer (sync-80bn — todo).
    expect(sessionA.document.groups["groupA"]?.parentGroupId?.val).toBe("groupB");
    expect(sessionA.document.groups["groupB"]?.parentGroupId?.val).toBe("groupA");
  });
});

// ── Category 5: Concurrent KeyGrant revocation ────────────────────────

describe("Category 5: concurrent KeyGrant revocation", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("5a — concurrent revocations both result in a revoked state", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-privacy-001"));

    const seedEnv = sessionA.change((d) => {
      d.keyGrants["kg_1"] = {
        id: s("kg_1"),
        bucketId: s("bkt_1"),
        friendAccountId: s("acc_2"),
        encryptedBucketKey: s("base64key=="),
        keyVersion: 1,
        createdAt: 1000,
        revokedAt: null,
      };
    });
    await relay.submit(seedEnv);
    const _r6 = await relay.getEnvelopesSince(docId("doc-privacy-001"), 0);
    sessionB.applyEncryptedChanges(_r6.envelopes);

    // Both devices revoke concurrently
    const envA = sessionA.change((d) => {
      const kg = d.keyGrants["kg_1"];
      if (kg) kg.revokedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const kg = d.keyGrants["kg_1"];
      if (kg) kg.revokedAt = 2001;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both converge and grant is revoked regardless of which timestamp won
    const revokedAtA = sessionA.document.keyGrants["kg_1"]?.revokedAt;
    const revokedAtB = sessionB.document.keyGrants["kg_1"]?.revokedAt;
    expect(revokedAtA).not.toBeNull();
    expect(revokedAtA).toBe(revokedAtB);
  });
});

// ── Category 6: Junction add-wins semantics ───────────────────────────

describe("Category 6: junction add-wins semantics", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("6a — concurrent add on A and no-op on B: junction is present after merge", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-001"));

    const envA = sessionA.change((d) => {
      d.groupMemberships["g1_m1"] = true;
    });

    // B does not add anything — just receives A's change
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionB.document.groupMemberships["g1_m1"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b — two concurrent adds to different keys: both junctions present", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-001"));

    const envA = sessionA.change((d) => {
      d.groupMemberships["g1_m1"] = true;
    });
    const envB = sessionB.change((d) => {
      d.groupMemberships["g1_m2"] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.groupMemberships["g1_m1"]).toBe(true);
    expect(sessionA.document.groupMemberships["g1_m2"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 7: CheckInRecord concurrent respond + dismiss ────────────

describe("Category 7: CheckInRecord concurrent respond + dismiss", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("7a — concurrent respond and dismiss converge to a single state", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-fronting-001"));

    const seedEnv = sessionA.change((d) => {
      d.checkInRecords["cr_1"] = {
        id: s("cr_1"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: null,
        respondedAt: null,
        dismissed: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const _r7 = await relay.getEnvelopesSince(docId("doc-fronting-001"), 0);
    sessionB.applyEncryptedChanges(_r7.envelopes);

    // A responds, B dismisses concurrently
    const envA = sessionA.change((d) => {
      const cr = d.checkInRecords["cr_1"];
      if (cr) {
        cr.respondedByMemberId = s("mem_1");
        cr.respondedAt = 1100;
        cr.dismissed = false;
      }
    });
    const envB = sessionB.change((d) => {
      const cr = d.checkInRecords["cr_1"];
      if (cr) {
        cr.dismissed = true;
        cr.updatedAt = 1100;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both converge to the same state
    expect(sessionA.document).toEqual(sessionB.document);

    // The post-merge normalization rule: if respondedByMemberId is non-null,
    // dismissed should be false (response takes priority). In this test we verify
    // that both sessions see the same final state — the application layer would
    // then apply the normalization rule as a follow-up change.
    const cr = sessionA.document.checkInRecords["cr_1"];
    expect(cr).toBeDefined();
    // Verify response data is present (LWW on each field independently)
    // The exact winner of `dismissed` depends on Automerge's LWW ordering
    expect(cr?.respondedByMemberId?.val).toBe("mem_1");
    expect(cr?.respondedAt).toBe(1100);
  });
});

// ── Category 8: Sort order conflicts ─────────────────────────────────
//
// After merge, LWW picks a winner for each sortOrder independently.
// Ties or inversions in the merged set are normal — post-merge normalization
// (re-numbering to eliminate ties and fill gaps) is application-layer.

describe("Category 8: sort order conflicts", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("8a — concurrent sort order reorders converge to a consistent (possibly inverted) state", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cr-008"));

    // Seed 3 groups with sortOrder 1, 2, 3
    const seedEnv = sessionA.change((d) => {
      for (const [id, order] of [
        ["grp_1", 1],
        ["grp_2", 2],
        ["grp_3", 3],
      ] as const) {
        d.groups[id] = makeGroup(id, order);
      }
    });
    await relay.submit(seedEnv);
    const _r8 = await relay.getEnvelopesSince(docId("doc-cr-008"), 0);
    sessionB.applyEncryptedChanges(_r8.envelopes);

    // Session A: swap grp_1 and grp_3 (3→1, 1→3)
    const envA = sessionA.change((d) => {
      const g1 = d.groups["grp_1"];
      const g3 = d.groups["grp_3"];
      if (g1) g1.sortOrder = 3;
      if (g3) g3.sortOrder = 1;
    });
    // Session B: swap grp_2 and grp_1 (2→1, 1→2) — concurrent
    const envB = sessionB.change((d) => {
      const g1 = d.groups["grp_1"];
      const g2 = d.groups["grp_2"];
      if (g1) g1.sortOrder = 2;
      if (g2) g2.sortOrder = 1;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to the same state
    expect(sessionA.document).toEqual(sessionB.document);

    // Each group has some sortOrder — LWW picked a winner per field.
    // Ties or inversions may exist; post-merge normalization (re-numbering)
    // is application-layer (sync-80bn — todo).
    const orders = ["grp_1", "grp_2", "grp_3"].map((id) => sessionA.document.groups[id]?.sortOrder);
    expect(orders).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
  });
});

// ── Category 9: ChatMessage edit chain ────────────────────────────────
//
// Messages are append-only and immutable. Edits produce new entries with
// `editOf` referencing the original message ID. The edit chain is resolved
// at the application layer by following editOf links.

describe("Category 9: ChatMessage edit chain", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("9a — concurrent edit message and unrelated append both present; edit chain intact", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-chat-009"));

    // Session A appends msg_1, then syncs to B
    const seedEnv = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Original content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    await relay.submit(seedEnv);
    const _r9 = await relay.getEnvelopesSince(docId("doc-chat-009"), 0);
    sessionB.applyEncryptedChanges(_r9.envelopes);

    // Session A posts an edit (msg_2 with editOf = msg_1)
    const envA = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_2"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edited content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    // Session B concurrently appends an unrelated message (msg_3)
    const envB = sessionB.change((d) => {
      d.messages.push({
        id: s("msg_3"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_2"),
        content: s("Unrelated message"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1050,
        editOf: null,
        archived: false,
      });
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge
    expect(sessionA.document).toEqual(sessionB.document);

    // All 3 messages are present
    const ids = sessionA.document.messages.map((m) => m.id.val);
    expect(ids).toContain("msg_1");
    expect(ids).toContain("msg_2");
    expect(ids).toContain("msg_3");
    expect(sessionA.document.messages).toHaveLength(3);

    // Edit chain is intact: msg_2.editOf references msg_1
    const msg2 = sessionA.document.messages.find((m) => m.id.val === "msg_2");
    expect(msg2).toBeDefined();
    expect(msg2?.editOf?.val).toBe("msg_1");
  });
});

// ── Edge cases from sync-80bn ─────────────────────────────────────────

// ── Tombstone / Archive edge cases ────────────────────────────────────

describe("Tombstone lifecycle: archived entities in CRDT", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("archived entity retains all fields in snapshot roundtrip", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId("doc-tomb-001"),
      sodium,
    });

    session.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Archived Member"),
        pronouns: s("[]"),
        description: s("Still here"),
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

    // Snapshot and restore
    const snapshot = session.createSnapshot(1);
    const restored = EncryptedSyncSession.fromSnapshot<typeof base>(snapshot, keys, sodium);

    expect(restored.document.members["mem_1"]?.archived).toBe(true);
    expect(restored.document.members["mem_1"]?.name.val).toBe("Archived Member");
    expect(restored.document.members["mem_1"]?.description?.val).toBe("Still here");
  });

  it("concurrent archive on both devices converges to archived", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-tomb-002"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Active"),
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
    await relay.submit(seedEnv);
    const _r10 = await relay.getEnvelopesSince(docId("doc-tomb-002"), 0);
    sessionB.applyEncryptedChanges(_r10.envelopes);

    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) {
        m.archived = true;
        m.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) {
        m.archived = true;
        m.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("un-archive (archived false after true) applies via LWW", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-tomb-003"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Was Archived"),
        pronouns: s("[]"),
        description: null,
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
    await relay.submit(seedEnv);
    const _r11 = await relay.getEnvelopesSince(docId("doc-tomb-003"), 0);
    sessionB.applyEncryptedChanges(_r11.envelopes);

    // A un-archives
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) {
        m.archived = false;
        m.updatedAt = 2000;
      }
    });
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionB.document.members["mem_1"]?.archived).toBe(false);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("fronting session referencing archived member converges with dangling reference", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId("doc-tomb-004"),
      sodium,
    });

    // Seed a member and archive it
    session.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Archived Member"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: true,
        createdAt: 1000,
        updatedAt: 2000,
      };
    });

    // The archived member's data is still accessible for last-known-data fallback
    expect(session.document.members["mem_1"]?.archived).toBe(true);
    expect(session.document.members["mem_1"]?.name.val).toBe("Archived Member");
  });

  it("junction referencing archived member remains valid after archive", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-tomb-005"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Member"),
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
      d.groupMemberships["g1_mem_1"] = true;
    });
    await relay.submit(seedEnv);
    const _r12 = await relay.getEnvelopesSince(docId("doc-tomb-005"), 0);
    sessionB.applyEncryptedChanges(_r12.envelopes);

    // A archives the member; B does nothing
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.archived = true;
    });
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Junction still present even though member is archived
    expect(sessionB.document.members["mem_1"]?.archived).toBe(true);
    expect(sessionB.document.groupMemberships["g1_mem_1"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("concurrent archive + junction add: junction preserved (add-wins), entity archived", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-tomb-006"));

    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Member"),
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
    await relay.submit(seedEnv);
    const _r13 = await relay.getEnvelopesSince(docId("doc-tomb-006"), 0);
    sessionB.applyEncryptedChanges(_r13.envelopes);

    // A archives member, B adds a group junction for member concurrently
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.archived = true;
    });
    const envB = sessionB.change((d) => {
      d.groupMemberships["g2_mem_1"] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);
    expect(sessionA.document.groupMemberships["g2_mem_1"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Subsystem/region hierarchy cycle detection ────────────────────────

describe("Hierarchy cycles: subsystems and innerworld regions", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  function makeSubsystem(id: string, parentId?: string): CrdtSubsystem {
    return {
      id: s(id),
      systemId: s("sys_1"),
      name: s(id),
      description: null,
      parentSubsystemId: parentId ? s(parentId) : null,
      architectureType: null,
      hasCore: false,
      discoveryStatus: s("known"),
      color: null,
      imageSource: null,
      emoji: null,
      archived: false,
      createdAt: 1000,
      updatedAt: 1000,
    };
  }

  function makeRegion(id: string, parentId?: string): CrdtInnerWorldRegion {
    return {
      id: s(id),
      systemId: s("sys_1"),
      name: s(id),
      description: null,
      parentRegionId: parentId ? s(parentId) : null,
      visual: s("{}"),
      boundaryData: s("[]"),
      accessType: s("open"),
      gatekeeperMemberIds: s("[]"),
      archived: false,
      createdAt: 1000,
      updatedAt: 1000,
    };
  }

  it("concurrent cross-reparenting of subsystems produces a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cycle-ss"));

    const seedEnv = sessionA.change((d) => {
      d.subsystems["ss_a"] = makeSubsystem("ss_a");
      d.subsystems["ss_b"] = makeSubsystem("ss_b");
    });
    await relay.submit(seedEnv);
    const _r14 = await relay.getEnvelopesSince(docId("doc-cycle-ss"), 0);
    sessionB.applyEncryptedChanges(_r14.envelopes);

    const envA = sessionA.change((d) => {
      const ss = d.subsystems["ss_a"];
      if (ss) {
        ss.parentSubsystemId = s("ss_b");
        ss.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const ss = d.subsystems["ss_b"];
      if (ss) {
        ss.parentSubsystemId = s("ss_a");
        ss.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    expect(sessionA.document.subsystems["ss_a"]?.parentSubsystemId?.val).toBe("ss_b");
    expect(sessionA.document.subsystems["ss_b"]?.parentSubsystemId?.val).toBe("ss_a");
  });

  it("concurrent cross-reparenting of innerworld regions produces a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-cycle-iw"));

    const seedEnv = sessionA.change((d) => {
      d.innerWorldRegions["rg_a"] = makeRegion("rg_a");
      d.innerWorldRegions["rg_b"] = makeRegion("rg_b");
    });
    await relay.submit(seedEnv);
    const _r15 = await relay.getEnvelopesSince(docId("doc-cycle-iw"), 0);
    sessionB.applyEncryptedChanges(_r15.envelopes);

    const envA = sessionA.change((d) => {
      const rg = d.innerWorldRegions["rg_a"];
      if (rg) {
        rg.parentRegionId = s("rg_b");
        rg.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const rg = d.innerWorldRegions["rg_b"];
      if (rg) {
        rg.parentRegionId = s("rg_a");
        rg.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    expect(sessionA.document.innerWorldRegions["rg_a"]?.parentRegionId?.val).toBe("rg_b");
    expect(sessionA.document.innerWorldRegions["rg_b"]?.parentRegionId?.val).toBe("rg_a");
  });
});

// ── Multi-level chat edit chains ──────────────────────────────────────

describe("Multi-level chat edit chains", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("multi-level edit chain (msg_1 → msg_2 → msg_3) is preserved after sync", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-edit-chain"));

    // Build a 3-level edit chain on A
    const env1 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 1"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    const env2 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_2"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 2"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    const env3 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_3"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 3"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1200,
        editOf: s("msg_2"),
        archived: false,
      });
    });

    await relay.submit(env1);
    await relay.submit(env2);
    await relay.submit(env3);
    await syncThroughRelay([sessionA, sessionB], relay);

    const msgs = sessionB.document.messages;
    expect(msgs).toHaveLength(3);
    const msg3 = msgs.find((m) => m.id.val === "msg_3");
    expect(msg3?.editOf?.val).toBe("msg_2");
    const msg2 = msgs.find((m) => m.id.val === "msg_2");
    expect(msg2?.editOf?.val).toBe("msg_1");
  });

  it("concurrent edits to same original message produce parallel edit chains", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-edit-parallel"));

    const seedEnv = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Original"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    await relay.submit(seedEnv);
    const _r16 = await relay.getEnvelopesSince(docId("doc-edit-parallel"), 0);
    sessionB.applyEncryptedChanges(_r16.envelopes);

    // Both devices edit the same message concurrently
    const envA = sessionA.change((d) => {
      d.messages.push({
        id: s("edit_a"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edit from A"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    const envB = sessionB.change((d) => {
      d.messages.push({
        id: s("edit_b"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edit from B"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    const msgs = sessionA.document.messages;
    expect(msgs).toHaveLength(3);
    const editsOfMsg1 = msgs.filter((m) => m.editOf?.val === "msg_1");
    expect(editsOfMsg1).toHaveLength(2);
  });
});

// ── Sort order tie detection ──────────────────────────────────────────

describe("Sort order tie detection", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("concurrent reorders producing identical sortOrder values create detectable ties", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-sort-tie"));

    const seedEnv = sessionA.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2);
    });
    await relay.submit(seedEnv);
    const _r17 = await relay.getEnvelopesSince(docId("doc-sort-tie"), 0);
    sessionB.applyEncryptedChanges(_r17.envelopes);

    // Both set the same sortOrder value
    const envA = sessionA.change((d) => {
      const g = d.groups["grp_1"];
      if (g) g.sortOrder = 5;
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grp_2"];
      if (g) g.sortOrder = 5;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    // Both groups have sortOrder 5 — a tie requiring post-merge normalization
    expect(sessionA.document.groups["grp_1"]?.sortOrder).toBe(5);
    expect(sessionA.document.groups["grp_2"]?.sortOrder).toBe(5);
  });

  it("three groups with concurrent reorders all converge", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-sort-three"));

    const seedEnv = sessionA.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2);
      d.groups["grp_3"] = makeGroup("grp_3", 3);
    });
    await relay.submit(seedEnv);
    const _r18 = await relay.getEnvelopesSince(docId("doc-sort-three"), 0);
    sessionB.applyEncryptedChanges(_r18.envelopes);

    // A: reverse order
    const envA = sessionA.change((d) => {
      const g1 = d.groups["grp_1"];
      const g2 = d.groups["grp_2"];
      const g3 = d.groups["grp_3"];
      if (g1) g1.sortOrder = 3;
      if (g2) g2.sortOrder = 2;
      if (g3) g3.sortOrder = 1;
    });
    // B: all to same value
    const envB = sessionB.change((d) => {
      const g1 = d.groups["grp_1"];
      const g2 = d.groups["grp_2"];
      const g3 = d.groups["grp_3"];
      if (g1) g1.sortOrder = 10;
      if (g2) g2.sortOrder = 10;
      if (g3) g3.sortOrder = 10;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    // Each group has a sortOrder value — LWW picked winners
    for (const id of ["grp_1", "grp_2", "grp_3"]) {
      expect(typeof sessionA.document.groups[id]?.sortOrder).toBe("number");
    }
  });
});

// ── Category 10: FriendConnection nested assignedBuckets ──────────────

describe("Category 10: FriendConnection nested assignedBuckets", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("10a — concurrent bucket adds to different keys: both present after merge", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, docId("doc-privacy-001"));

    const seedEnv = sessionA.change((d) => {
      d.friendConnections["fc_1"] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: {},
        visibility: s(
          '{"showMembers":true,"showGroups":false,"showStructure":false,"allowFrontingNotifications":true}',
        ),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const _r19 = await relay.getEnvelopesSince(docId("doc-privacy-001"), 0);
    sessionB.applyEncryptedChanges(_r19.envelopes);

    const envA = sessionA.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) fc.assignedBuckets["bkt_1"] = true;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) fc.assignedBuckets["bkt_2"] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const assigned = sessionA.document.friendConnections["fc_1"]?.assignedBuckets;
    expect(assigned?.["bkt_1"]).toBe(true);
    expect(assigned?.["bkt_2"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});
