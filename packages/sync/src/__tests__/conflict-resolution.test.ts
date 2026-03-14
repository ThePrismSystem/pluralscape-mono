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

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

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
  docId: string,
): [EncryptedSyncSession<T>, EncryptedSyncSession<T>] {
  return [
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
  ];
}

// ── Category 1: Concurrent edits to LWW map entities ─────────────────

describe("Category 1: concurrent edits to LWW map entities", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("1a — concurrent edits to different fields both survive", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cr-001", 0));

    // Concurrent edits to different fields
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("New Name");
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.description = s("New description");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members["mem_1"]?.name.val).toBe("New Name");
    expect(sessionA.document.members["mem_1"]?.description?.val).toBe("New description");
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("1b — concurrent edits to same field converge deterministically (LWW)", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cr-001", 0));

    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Name from A");
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Name from B");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions must converge to the same value
    expect(sessionA.document.members["mem_1"]?.name.val).toBe(
      sessionB.document.members["mem_1"]?.name.val,
    );
    // The winning value must be one of the two candidates
    const winner = sessionA.document.members["mem_1"]?.name.val;
    expect(["Name from A", "Name from B"]).toContain(winner);
  });

  it("1c — concurrent archive + edit: both changes apply independently", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cr-001", 0));

    // A archives, B edits name — both should apply
    const envA = sessionA.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.archived = true;
    });
    const envB = sessionB.change((d) => {
      const m = d.members["mem_1"];
      if (m) m.name = s("Edited while archived");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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

  it("2a — concurrent appends to switches list: both entries present after merge", () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-fronting-001");

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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

  it("3a — concurrent end-time writes converge to a single LWW winner", () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-fronting-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-fronting-001", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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
// (tested and implemented in sync-80bn — conflict resolution rules).

describe("Category 4: concurrent re-parenting creating cycles", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("4a — concurrent cross-parent writes both apply, producing a detectable cycle", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-004");

    // Seed two root groups (no parent)
    const seedEnv = sessionA.change((d) => {
      d.groups["groupA"] = {
        id: s("groupA"),
        systemId: s("sys_1"),
        name: s("Group A"),
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
      d.groups["groupB"] = {
        id: s("groupB"),
        systemId: s("sys_1"),
        name: s("Group B"),
        description: null,
        parentGroupId: null,
        imageSource: null,
        color: null,
        emoji: null,
        sortOrder: 2,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cr-004", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge
    expect(sessionA.document).toEqual(sessionB.document);

    // Both parentGroupId values are set — cycle is present in merged state.
    // Post-merge cycle detection (DFS traversal) is application-layer (sync-80bn).
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

  it("5a — concurrent revocations both result in a revoked state", () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-privacy-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-privacy-001", 0));

    // Both devices revoke concurrently
    const envA = sessionA.change((d) => {
      const kg = d.keyGrants["kg_1"];
      if (kg) kg.revokedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const kg = d.keyGrants["kg_1"];
      if (kg) kg.revokedAt = 2001;
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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

  it("6a — concurrent add on A and no-op on B: junction is present after merge", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-001");

    const envA = sessionA.change((d) => {
      d.groupMemberships["g1_m1"] = true;
    });

    // B does not add anything — just receives A's change
    relay.submit(envA);
    syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionB.document.groupMemberships["g1_m1"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b — two concurrent adds to different keys: both junctions present", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-001");

    const envA = sessionA.change((d) => {
      d.groupMemberships["g1_m1"] = true;
    });
    const envB = sessionB.change((d) => {
      d.groupMemberships["g1_m2"] = true;
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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

  it("7a — concurrent respond and dismiss converge to a single state", () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-fronting-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-fronting-001", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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

  it("8a — concurrent sort order reorders converge to a consistent (possibly inverted) state", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cr-008");

    // Seed 3 groups with sortOrder 1, 2, 3
    const seedEnv = sessionA.change((d) => {
      for (const [id, order] of [
        ["grp_1", 1],
        ["grp_2", 2],
        ["grp_3", 3],
      ] as const) {
        d.groups[id] = {
          id: s(id),
          systemId: s("sys_1"),
          name: s(`Group ${String(order)}`),
          description: null,
          parentGroupId: null,
          imageSource: null,
          color: null,
          emoji: null,
          sortOrder: order,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        };
      }
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cr-008", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to the same state
    expect(sessionA.document).toEqual(sessionB.document);

    // Each group has some sortOrder — LWW picked a winner per field.
    // Ties or inversions may exist; post-merge normalization (re-numbering)
    // is application-layer (sync-80bn).
    const orders = ["grp_1", "grp_2", "grp_3"].map((id) => sessionA.document.groups[id]?.sortOrder);
    expect(orders.every((o) => o !== undefined)).toBe(true);
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

  it("9a — concurrent edit message and unrelated append both present; edit chain intact", () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-chat-009");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-chat-009", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

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
    expect(msg2?.editOf?.val).toBe("msg_1");
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

  it("10a — concurrent bucket adds to different keys: both present after merge", () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-privacy-001");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-privacy-001", 0));

    const envA = sessionA.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) fc.assignedBuckets["bkt_1"] = true;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) fc.assignedBuckets["bkt_2"] = true;
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const assigned = sessionA.document.friendConnections["fc_1"]?.assignedBuckets;
    expect(assigned?.["bkt_1"]).toBe(true);
    expect(assigned?.["bkt_2"]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});
