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
  asFrontingSessionId,
  asKeyGrantId,
  asMemberId,
  asSyncDocId,
} from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Category 1: Concurrent edits to LWW map entities ─────────────────

describe("Category 1: concurrent edits to LWW map entities", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("1a — concurrent edits to different fields both survive", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-001"), sodium);

    // Seed a member in both sessions
    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r1 = await relay.getEnvelopesSince(asSyncDocId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r1.envelopes);

    // Concurrent edits to different fields
    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.name = s("New Name");
    });
    const envB = sessionB.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.description = s("New description");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members[asMemberId("mem_1")]?.name.val).toBe("New Name");
    expect(sessionA.document.members[asMemberId("mem_1")]?.description?.val).toBe(
      "New description",
    );
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("1b — concurrent edits to same field converge deterministically (LWW)", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-001"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r2 = await relay.getEnvelopesSince(asSyncDocId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r2.envelopes);

    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.name = s("Name from A");
    });
    const envB = sessionB.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.name = s("Name from B");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions must converge to the same value
    expect(sessionA.document.members[asMemberId("mem_1")]?.name.val).toBe(
      sessionB.document.members[asMemberId("mem_1")]?.name.val,
    );
    // The winning value must be one of the two candidates
    const winner = sessionA.document.members[asMemberId("mem_1")]?.name.val;
    expect(["Name from A", "Name from B"]).toContain(winner);
  });

  it("1c — concurrent archive + edit: both changes apply independently", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-001"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r3 = await relay.getEnvelopesSince(asSyncDocId("doc-cr-001"), 0);
    sessionB.applyEncryptedChanges(_r3.envelopes);

    // A archives, B edits name — both should apply
    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.archived = true;
    });
    const envB = sessionB.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.name = s("Edited while archived");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Entity is archived AND has the edited name
    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(sessionA.document.members[asMemberId("mem_1")]?.name.val).toBe("Edited while archived");
    expect(sessionA.document).toEqual(sessionB.document);
  });
});

// ── Category 3: Concurrent FrontingSession end time ───────────────────

describe("Category 3: concurrent FrontingSession end time", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("3a — concurrent end-time writes converge to a single LWW winner", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-fronting-001"), sodium);

    const seedEnv = sessionA.change((d) => {
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
    await relay.submit(seedEnv);
    const _r4 = await relay.getEnvelopesSince(asSyncDocId("doc-fronting-001"), 0);
    sessionB.applyEncryptedChanges(_r4.envelopes);

    // Both sessions try to end the session concurrently
    const envA = sessionA.change((d) => {
      const fs = d.sessions[asFrontingSessionId("fs_1")];
      if (fs) {
        fs.endTime = 2000;
        fs.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const fs = d.sessions[asFrontingSessionId("fs_1")];
      if (fs) {
        fs.endTime = 2100;
        fs.updatedAt = 2100;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to the same endTime (LWW picks one)
    const endA = sessionA.document.sessions[asFrontingSessionId("fs_1")]?.endTime;
    const endB = sessionB.document.sessions[asFrontingSessionId("fs_1")]?.endTime;
    expect(endA).not.toBeNull();
    expect(endA).toBe(endB);
    // The winner is one of the two candidates
    expect([2000, 2100]).toContain(endA);
  });
});

// ── Category 5: Concurrent KeyGrant revocation ────────────────────────

describe("Category 5: concurrent KeyGrant revocation", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("5a — concurrent revocations both result in a revoked state", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-privacy-001"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.keyGrants[asKeyGrantId("kg_1")] = {
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
    const _r6 = await relay.getEnvelopesSince(asSyncDocId("doc-privacy-001"), 0);
    sessionB.applyEncryptedChanges(_r6.envelopes);

    // Both devices revoke concurrently
    const envA = sessionA.change((d) => {
      const kg = d.keyGrants[asKeyGrantId("kg_1")];
      if (kg) kg.revokedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const kg = d.keyGrants[asKeyGrantId("kg_1")];
      if (kg) kg.revokedAt = 2001;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both converge and grant is revoked regardless of which timestamp won
    const revokedAtA = sessionA.document.keyGrants[asKeyGrantId("kg_1")]?.revokedAt;
    const revokedAtB = sessionB.document.keyGrants[asKeyGrantId("kg_1")]?.revokedAt;
    expect(revokedAtA).not.toBeNull();
    expect(revokedAtA).toBe(revokedAtB);
  });
});
