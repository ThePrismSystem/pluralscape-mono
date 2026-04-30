import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { syncThroughRelay } from "../sync-session.js";

import { getSodium, makeKeys, makeSessions, s } from "./helpers/conflict-resolution-fixtures.js";
import {
  asBucketId,
  asCheckInRecordId,
  asFriendConnectionId,
  asGroupMembershipKey,
  asSyncDocId,
  asSystemStructureEntityLinkId,
  asSystemStructureEntityMemberLinkId,
} from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Category 6: Junction add-wins semantics ───────────────────────────

describe("Category 6: junction add-wins semantics", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("6a — concurrent add on A and no-op on B: junction is present after merge", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-001"), sodium);

    const envA = sessionA.change((d) => {
      d.groupMemberships[asGroupMembershipKey("g1:m1")] = true;
    });

    // B does not add anything — just receives A's change
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionB.document.groupMemberships[asGroupMembershipKey("g1:m1")]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b — two concurrent adds to different keys: both junctions present", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-001"), sodium);

    const envA = sessionA.change((d) => {
      d.groupMemberships[asGroupMembershipKey("g1:m1")] = true;
    });
    const envB = sessionB.change((d) => {
      d.groupMemberships[asGroupMembershipKey("g1:m2")] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.groupMemberships[asGroupMembershipKey("g1:m1")]).toBe(true);
    expect(sessionA.document.groupMemberships[asGroupMembershipKey("g1:m2")]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 6b: LWW structure entity link merge semantics ────────────

describe("Category 6b: LWW structure entity link merge semantics", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("6b-a — concurrent sortOrder edits on same link: LWW resolves to one value", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-6b"), sodium);

    // Seed a structure entity link
    const seedEnv = sessionA.change((d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")] = {
        id: s("stel_1"),
        systemId: s("sys_1"),
        entityId: s("ste_1"),
        parentEntityId: s("ste_parent"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const r6b = await relay.getEnvelopesSince(asSyncDocId("doc-cr-6b"), 0);
    sessionB.applyEncryptedChanges(r6b.envelopes);

    // Concurrent edits to sortOrder
    const envA = sessionA.change((d) => {
      const link = d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")];
      if (link) {
        link.sortOrder = 10;
        link.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const link = d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")];
      if (link) {
        link.sortOrder = 20;
        link.updatedAt = 2000;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // LWW resolves to one value — both sessions agree
    const resultA =
      sessionA.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.sortOrder;
    const resultB =
      sessionB.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.sortOrder;
    expect(resultA).toBe(resultB);
    expect([10, 20]).toContain(resultA);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b-b — concurrent edits to different links: both edits preserved", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-6b-b"), sodium);

    // Seed two links
    const seedEnv = sessionA.change((d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")] = {
        id: s("stel_1"),
        systemId: s("sys_1"),
        entityId: s("ste_1"),
        parentEntityId: null,
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_2")] = {
        id: s("stel_2"),
        systemId: s("sys_1"),
        entityId: s("ste_2"),
        parentEntityId: null,
        sortOrder: 2,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const r6bb = await relay.getEnvelopesSince(asSyncDocId("doc-cr-6b-b"), 0);
    sessionB.applyEncryptedChanges(r6bb.envelopes);

    // A edits link 1, B edits link 2
    const envA = sessionA.change((d) => {
      const link = d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")];
      if (link) link.sortOrder = 99;
    });
    const envB = sessionB.change((d) => {
      const link = d.structureEntityLinks[asSystemStructureEntityLinkId("stel_2")];
      if (link) link.sortOrder = 77;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(
      sessionA.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.sortOrder,
    ).toBe(99);
    expect(
      sessionA.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_2")]?.sortOrder,
    ).toBe(77);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b-c — one session deletes link, other edits sortOrder: delete wins", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-6b-c"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")] = {
        id: s("steml_1"),
        systemId: s("sys_1"),
        parentEntityId: s("ste_1"),
        memberId: s("mem_1"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const r6bc = await relay.getEnvelopesSince(asSyncDocId("doc-cr-6b-c"), 0);
    sessionB.applyEncryptedChanges(r6bc.envelopes);

    // A deletes, B edits concurrently
    const envA = sessionA.change((d) => {
      Reflect.deleteProperty(
        d.structureEntityMemberLinks,
        asSystemStructureEntityMemberLinkId("steml_1"),
      );
    });
    const envB = sessionB.change((d) => {
      const link = d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")];
      if (link) link.sortOrder = 50;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Automerge: delete wins over concurrent field edit in a map
    expect(
      sessionA.document.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")],
    ).toBeUndefined();
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("6b-d — concurrent creation of same-keyed member link: LWW resolves", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-6b-d"), sodium);

    // Both create steml_1 with different memberId
    const envA = sessionA.change((d) => {
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")] = {
        id: s("steml_1"),
        systemId: s("sys_1"),
        parentEntityId: s("ste_1"),
        memberId: s("mem_a"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const envB = sessionB.change((d) => {
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")] = {
        id: s("steml_1"),
        systemId: s("sys_1"),
        parentEntityId: s("ste_1"),
        memberId: s("mem_b"),
        sortOrder: 2,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to same value
    const resultA =
      sessionA.document.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]
        ?.memberId.val;
    const resultB =
      sessionB.document.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]
        ?.memberId.val;
    expect(resultA).toBe(resultB);
    expect(["mem_a", "mem_b"]).toContain(resultA);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 7: CheckInRecord concurrent respond + dismiss ────────────

describe("Category 7: CheckInRecord concurrent respond + dismiss", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("7a — concurrent respond and dismiss converge to a single state", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-fronting-001"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.checkInRecords[asCheckInRecordId("cr_1")] = {
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
    const _r7 = await relay.getEnvelopesSince(asSyncDocId("doc-fronting-001"), 0);
    sessionB.applyEncryptedChanges(_r7.envelopes);

    // A responds, B dismisses concurrently
    const envA = sessionA.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (cr) {
        cr.respondedByMemberId = s("mem_1");
        cr.respondedAt = 1100;
        cr.dismissed = false;
      }
    });
    const envB = sessionB.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
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
    const cr = sessionA.document.checkInRecords[asCheckInRecordId("cr_1")];
    expect(cr).toMatchObject({
      respondedAt: 1100,
    });
    // Verify response data is present (LWW on each field independently)
    // The exact winner of `dismissed` depends on Automerge's LWW ordering
    expect(cr?.respondedByMemberId?.val).toBe("mem_1");
  });
});

// ── Category 10: FriendConnection nested assignedBuckets ──────────────

describe("Category 10: FriendConnection nested assignedBuckets", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("10a — concurrent bucket adds to different keys: both present after merge", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-privacy-001"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_1")] = {
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
    const _r19 = await relay.getEnvelopesSince(asSyncDocId("doc-privacy-001"), 0);
    sessionB.applyEncryptedChanges(_r19.envelopes);

    const envA = sessionA.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) fc.assignedBuckets[asBucketId("bkt_1")] = true;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) fc.assignedBuckets[asBucketId("bkt_2")] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const assigned =
      sessionA.document.friendConnections[asFriendConnectionId("fc_1")]?.assignedBuckets;
    expect(assigned?.[asBucketId("bkt_1")]).toBe(true);
    expect(assigned?.[asBucketId("bkt_2")]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});
