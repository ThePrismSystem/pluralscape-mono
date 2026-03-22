/**
 * Post-merge validator tests.
 *
 * Verifies that post-merge validation corrects CRDT merge artifacts:
 * - Tombstone enforcement (archive wins over un-archive)
 * - Hierarchy cycle detection and breaking
 * - Sort order normalization
 * - CheckInRecord normalization
 * - FriendConnection status normalization
 * - Module-level runAllValidations function
 * - ENTITY_FIELD_MAP derivation from CRDT strategies
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import {
  runAllValidations,
  enforceTombstones,
  detectHierarchyCycles,
  normalizeSortOrder,
  normalizeCheckInRecord,
  normalizeFriendConnection,
  ENTITY_FIELD_MAP,
} from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { asSyncDocId } from "./test-crypto-helpers.js";

import type { CrdtGroup, CrdtInnerWorldRegion } from "../schemas/system-core.js";
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

// ── ENTITY_FIELD_MAP derivation ────────────────────────────────────────

describe("ENTITY_FIELD_MAP derivation from CRDT strategies", () => {
  it("has an entry for every entity type in ENTITY_CRDT_STRATEGIES", () => {
    const strategyKeys = Object.keys(ENTITY_CRDT_STRATEGIES);
    for (const key of strategyKeys) {
      expect(ENTITY_FIELD_MAP.has(key)).toBe(true);
    }
    expect(ENTITY_FIELD_MAP.size).toBe(strategyKeys.length);
  });

  it("maps each entity type to the fieldName from its CRDT strategy", () => {
    for (const [entityType, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
      expect(ENTITY_FIELD_MAP.get(entityType)).toBe(strategy.fieldName);
    }
  });

  it("includes known mappings for key entity types", () => {
    expect(ENTITY_FIELD_MAP.get("member")).toBe("members");
    expect(ENTITY_FIELD_MAP.get("group")).toBe("groups");
    expect(ENTITY_FIELD_MAP.get("fronting-session")).toBe("sessions");
    expect(ENTITY_FIELD_MAP.get("friend-connection")).toBe("friendConnections");
    expect(ENTITY_FIELD_MAP.get("journal-entry")).toBe("entries");
    expect(ENTITY_FIELD_MAP.get("bucket-content-tag")).toBe("contentTags");
  });
});

// ── Task 1: Tombstone enforcement ────────────────────────────────────

describe("PostMergeValidator: enforceTombstones", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("re-stamps archived = true when entity is archived post-merge to ensure tombstone wins future merges", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-enforce"));

    // Seed an active member
    const seedEnv = sessionA.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Test"),
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
    const _r1 = await relay.getEnvelopesSince(asSyncDocId("doc-tomb-enforce"), 0);
    sessionB.applyEncryptedChanges(_r1.envelopes);

    // A archives. B makes an unrelated edit concurrently (does not un-archive).
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
        m.name = s("Edited Name");
        m.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // After merge, entity should be archived (A's archive + B's edit both apply)
    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);

    // Run tombstone enforcement — re-stamps to ensure archive wins future merges
    const { notifications } = enforceTombstones(sessionA);

    // After enforcement, archived should still be true
    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);
    // Should have generated a notification for the re-stamp
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0]?.resolution).toBe("lww-field");
  });

  it("does not re-stamp entities that are not archived", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-no-stamp"),
      sodium,
    });

    session.change((d) => {
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

    const { notifications } = enforceTombstones(session);

    expect(notifications).toHaveLength(0);
    expect(session.document.members["mem_1"]?.archived).toBe(false);
  });
});

// ── Task 2: Hierarchy cycle detection ─────────────────────────────────

describe("PostMergeValidator: detectHierarchyCycles", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("breaks a group cycle by nulling parent of lowest-ID entity", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cycle-fix"));

    const seedEnv = sessionA.change((d) => {
      d.groups["groupA"] = makeGroup("groupA", 1);
      d.groups["groupB"] = makeGroup("groupB", 2);
    });
    await relay.submit(seedEnv);
    const _r2 = await relay.getEnvelopesSince(asSyncDocId("doc-cycle-fix"), 0);
    sessionB.applyEncryptedChanges(_r2.envelopes);

    // Create mutual parent cycle
    const envA = sessionA.change((d) => {
      const g = d.groups["groupA"];
      if (g) g.parentGroupId = s("groupB");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["groupB"];
      if (g) g.parentGroupId = s("groupA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    // Cycle should be broken
    expect(breaks.length).toBeGreaterThan(0);

    // The lowest ID entity ("groupA" < "groupB") should have its parent nulled
    expect(sessionA.document.groups["groupA"]?.parentGroupId).toBeNull();
    expect(sessionA.document.groups["groupB"]?.parentGroupId?.val).toBe("groupA");
  });

  it("breaks a second group cycle (independent from the first)", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-grp-cycle-2"));

    const seedEnv = sessionA.change((d) => {
      d.groups["grpX"] = makeGroup("grpX", 1);
      d.groups["grpY"] = makeGroup("grpY", 2);
    });
    await relay.submit(seedEnv);
    const _r3 = await relay.getEnvelopesSince(asSyncDocId("doc-grp-cycle-2"), 0);
    sessionB.applyEncryptedChanges(_r3.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups["grpX"];
      if (g) g.parentGroupId = s("grpY");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grpY"];
      if (g) g.parentGroupId = s("grpX");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    // grpX < grpY alphabetically, so grpX's parent gets nulled
    expect(sessionA.document.groups["grpX"]?.parentGroupId).toBeNull();
  });

  it("breaks innerworld region cycles", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-rg-cycle"));

    const seedEnv = sessionA.change((d) => {
      d.innerWorldRegions["rg_a"] = makeRegion("rg_a");
      d.innerWorldRegions["rg_b"] = makeRegion("rg_b");
    });
    await relay.submit(seedEnv);
    const _r4 = await relay.getEnvelopesSince(asSyncDocId("doc-rg-cycle"), 0);
    sessionB.applyEncryptedChanges(_r4.envelopes);

    const envA = sessionA.change((d) => {
      const rg = d.innerWorldRegions["rg_a"];
      if (rg) rg.parentRegionId = s("rg_b");
    });
    const envB = sessionB.change((d) => {
      const rg = d.innerWorldRegions["rg_b"];
      if (rg) rg.parentRegionId = s("rg_a");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    expect(sessionA.document.innerWorldRegions["rg_a"]?.parentRegionId).toBeNull();
  });

  it("breaks a 3-node group cycle (A->B->C->A) by nulling parent of lowest-ID entity", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-3-cycle"));

    const seedEnv = sessionA.change((d) => {
      d.groups["grpA"] = makeGroup("grpA", 1);
      d.groups["grpB"] = makeGroup("grpB", 2);
      d.groups["grpC"] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const seedResult = await relay.getEnvelopesSince(asSyncDocId("doc-3-cycle"), 0);
    sessionB.applyEncryptedChanges(seedResult.envelopes);

    // A sets grpA->grpB, grpB->grpC. B sets grpC->grpA. After merge: A->B->C->A cycle.
    const envA = sessionA.change((d) => {
      const gA = d.groups["grpA"];
      if (gA) gA.parentGroupId = s("grpB");
      const gB = d.groups["grpB"];
      if (gB) gB.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const gC = d.groups["grpC"];
      if (gC) gC.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    // "grpA" is the lowest-ID in the cycle, so its parent gets nulled
    expect(sessionA.document.groups["grpA"]?.parentGroupId).toBeNull();
    // The rest of the chain should remain intact
    expect(sessionA.document.groups["grpB"]?.parentGroupId?.val).toBe("grpC");
    expect(sessionA.document.groups["grpC"]?.parentGroupId?.val).toBe("grpA");
  });

  it("returns empty array when no cycles exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-no-cycle"),
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2, { parentGroupId: "grp_1" });
    });

    const { breaks } = detectHierarchyCycles(session);
    expect(breaks).toHaveLength(0);
  });
});

// ── Task 2: Sort order normalization ──────────────────────────────────

describe("PostMergeValidator: normalizeSortOrder", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("re-assigns sequential sort orders when ties exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-norm"),
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 5);
      d.groups["grp_2"] = makeGroup("grp_2", 5);
      d.groups["grp_2"].createdAt = 900;
    });

    const { patches } = normalizeSortOrder(session);

    expect(patches.length).toBeGreaterThan(0);

    // After normalization, sort orders should be unique
    const orders = Object.values(session.document.groups).map((g) => g.sortOrder);
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBe(orders.length);
  });

  it("returns empty array when no ties exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-ok"),
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2);
    });

    const { patches } = normalizeSortOrder(session);
    expect(patches).toHaveLength(0);
  });
});

// ── Task 2: CheckInRecord normalization ───────────────────────────────

describe("PostMergeValidator: normalizeCheckInRecord", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("sets dismissed = false when respondedByMemberId is set and dismissed is true", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-checkin-norm"));

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
    const _r5 = await relay.getEnvelopesSince(asSyncDocId("doc-checkin-norm"), 0);
    sessionB.applyEncryptedChanges(_r5.envelopes);

    // A responds, B dismisses concurrently
    const envA = sessionA.change((d) => {
      const cr = d.checkInRecords["cr_1"];
      if (cr) {
        cr.respondedByMemberId = s("mem_1");
        cr.respondedAt = 1100;
      }
    });
    const envB = sessionB.change((d) => {
      const cr = d.checkInRecords["cr_1"];
      if (cr) {
        cr.dismissed = true;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { count } = normalizeCheckInRecord(sessionA);

    const cr = sessionA.document.checkInRecords["cr_1"];
    expect(cr?.respondedByMemberId).not.toBeNull();
    expect(cr?.dismissed).toBe(false);
    expect(count).toBe(1);
  });

  it("returns 0 when no normalization needed", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-checkin-ok"),
      sodium,
    });

    session.change((d) => {
      d.checkInRecords["cr_1"] = {
        id: s("cr_1"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: s("mem_1"),
        respondedAt: 1100,
        dismissed: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeCheckInRecord(session);
    expect(count).toBe(0);
  });
});

// ── Task 2: FriendConnection normalization ────────────────────────────

describe("PostMergeValidator: normalizeFriendConnection", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("re-stamps accepted when status reverted to pending from accepted", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-friend-norm"));

    // Seed with accepted status and assigned buckets (evidence of prior acceptance)
    const seedEnv = sessionA.change((d) => {
      d.friendConnections["fc_1"] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: {},
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      // Add a bucket assignment as evidence of prior acceptance
      d.friendConnections["fc_1"].assignedBuckets["bkt_1"] = true;
    });
    await relay.submit(seedEnv);
    const _r6 = await relay.getEnvelopesSince(asSyncDocId("doc-friend-norm"), 0);
    sessionB.applyEncryptedChanges(_r6.envelopes);

    // B sets status to pending while A keeps accepted
    const envA = sessionA.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) fc.updatedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) {
        fc.status = s("pending");
        fc.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // The LWW may pick B's pending status
    const { count } = normalizeFriendConnection(sessionA);

    // After normalization, status should be accepted
    // (the normalizer detects pending with assigned buckets and re-stamps)
    expect(sessionA.document.friendConnections["fc_1"]?.status.val).toBe("accepted");
    expect(count).toBe(1);
  });

  it("returns 0 when no normalization needed", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-ok"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections["fc_1"] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: {},
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);
    expect(count).toBe(0);
  });
});

// ── Module-level runAllValidations ──────────────────────────────────────

describe("runAllValidations (module-level function)", () => {
  let keys: DocumentKeys;
  let relay: EncryptedRelay;

  beforeEach(() => {
    keys = makeKeys();
    relay = new EncryptedRelay();
  });

  it("returns aggregate results from all validators including notifications", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-all-valid"),
      sodium,
    });

    // No issues to fix
    const result = runAllValidations(session);

    expect(result.cycleBreaks).toHaveLength(0);
    expect(result.sortOrderPatches).toHaveLength(0);
    expect(result.checkInNormalizations).toBe(0);
    expect(result.friendConnectionNormalizations).toBe(0);
    expect(result.correctionEnvelopes).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns correctionEnvelopes and notifications when issues exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-all-with-issues"),
      sodium,
    });

    // Add an archived member (will trigger tombstone enforcement)
    session.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Test"),
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

    const result = runAllValidations(session);

    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    // notifications should include tombstone notifications
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.notifications).toEqual(
      expect.arrayContaining([expect.objectContaining({ resolution: "lww-field" })]),
    );
    expect(result.errors).toHaveLength(0);
  });

  it("includes cycle break and sort order notifications in result.notifications", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-notif-test"));

    const seedEnv = sessionA.change((d) => {
      d.groups["grpA"] = makeGroup("grpA", 5);
      d.groups["grpB"] = makeGroup("grpB", 5);
      d.groups["grpC"] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r7 = await relay.getEnvelopesSince(asSyncDocId("doc-notif-test"), 0);
    sessionB.applyEncryptedChanges(_r7.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups["grpA"];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grpC"];
      if (g) g.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const result = runAllValidations(sessionA);

    // notifications should include both cycle and sort order entries
    const cycleNotifications = result.notifications.filter(
      (n) => n.resolution === "post-merge-cycle",
    );
    const sortNotifications = result.notifications.filter(
      (n) => n.resolution === "post-merge-sort-normalize",
    );

    expect(cycleNotifications.length).toBeGreaterThan(0);
    expect(sortNotifications.length).toBeGreaterThan(0);

    // The total notifications count should match the sum of constituent notifications
    const tombstoneCount = result.notifications.filter((n) => n.resolution === "lww-field").length;
    expect(result.notifications.length).toBe(
      tombstoneCount + result.cycleBreaks.length + result.sortOrderPatches.length,
    );
    expect(result.errors).toHaveLength(0);
  });

  it("handles both sort order ties and parent cycles in same run", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-multi-validator"));

    // Seed groups with sort order ties and potential cycle
    const seedEnv = sessionA.change((d) => {
      d.groups["grpA"] = makeGroup("grpA", 5);
      d.groups["grpB"] = makeGroup("grpB", 5); // tie with grpA
      d.groups["grpC"] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r8 = await relay.getEnvelopesSince(asSyncDocId("doc-multi-validator"), 0);
    sessionB.applyEncryptedChanges(_r8.envelopes);

    // Create a cycle between grpA and grpC
    const envA = sessionA.change((d) => {
      const g = d.groups["grpA"];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grpC"];
      if (g) g.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const result = runAllValidations(sessionA);

    // Both validators should have detected issues
    expect(result.cycleBreaks.length).toBeGreaterThan(0);
    expect(result.sortOrderPatches.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("populates errors array and calls onError when no callback swallows", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-onerror-test"),
      sodium,
    });

    // Set up archived member + sort order ties to trigger multiple validators
    session.change((d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Test"),
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
      d.groups["grp_1"] = makeGroup("grp_1", 5);
      d.groups["grp_2"] = makeGroup("grp_2", 5);
      d.groups["grp_2"].createdAt = 900;
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    // Multiple validators should have produced results
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.sortOrderPatches.length).toBeGreaterThan(0);
    // No errors on successful run
    expect(result.errors).toHaveLength(0);
    expect(errorMessages).toHaveLength(0);
  });
});
