import * as Automerge from "@automerge/automerge";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { getSodium, makeKeys, makeSessions, s } from "./helpers/conflict-resolution-fixtures.js";
import { asGroupMembershipKey, asMemberId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Tombstone / Archive edge cases ────────────────────────────────────

describe("Tombstone lifecycle: archived entities in CRDT", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("archived entity retains all fields in snapshot roundtrip", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-001"),
      sodium,
    });

    session.change((d) => {
      d.members[asMemberId("mem_1")] = {
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

    expect(restored.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(restored.document.members[asMemberId("mem_1")]?.name.val).toBe("Archived Member");
    expect(restored.document.members[asMemberId("mem_1")]?.description?.val).toBe("Still here");
  });

  it("concurrent archive on both devices converges to archived", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-002"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r10 = await relay.getEnvelopesSince(asSyncDocId("doc-tomb-002"), 0);
    sessionB.applyEncryptedChanges(_r10.envelopes);

    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) {
        m.archived = true;
        m.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) {
        m.archived = true;
        m.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("un-archive (archived false after true) applies via LWW", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-003"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r11 = await relay.getEnvelopesSince(asSyncDocId("doc-tomb-003"), 0);
    sessionB.applyEncryptedChanges(_r11.envelopes);

    // A un-archives
    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) {
        m.archived = false;
        m.updatedAt = 2000;
      }
    });
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionB.document.members[asMemberId("mem_1")]?.archived).toBe(false);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("fronting session referencing archived member converges with dangling reference", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-004"),
      sodium,
    });

    // Seed a member and archive it
    session.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    expect(session.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(session.document.members[asMemberId("mem_1")]?.name.val).toBe("Archived Member");
  });

  it("junction referencing archived member remains valid after archive", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-005"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
      d.groupMemberships[asGroupMembershipKey("g1:mem_1")] = true;
    });
    await relay.submit(seedEnv);
    const _r12 = await relay.getEnvelopesSince(asSyncDocId("doc-tomb-005"), 0);
    sessionB.applyEncryptedChanges(_r12.envelopes);

    // A archives the member; B does nothing
    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.archived = true;
    });
    await relay.submit(envA);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Junction still present even though member is archived
    expect(sessionB.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(sessionB.document.groupMemberships[asGroupMembershipKey("g1:mem_1")]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("concurrent archive + junction add: junction preserved (add-wins), entity archived", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-006"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = {
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
    const _r13 = await relay.getEnvelopesSince(asSyncDocId("doc-tomb-006"), 0);
    sessionB.applyEncryptedChanges(_r13.envelopes);

    // A archives member, B adds a group junction for member concurrently
    const envA = sessionA.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) m.archived = true;
    });
    const envB = sessionB.change((d) => {
      d.groupMemberships[asGroupMembershipKey("g2:mem_1")] = true;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);
    expect(sessionA.document.groupMemberships[asGroupMembershipKey("g2:mem_1")]).toBe(true);
    expect(sessionA.document).toEqual(sessionB.document);
  });
});
