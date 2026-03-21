/**
 * Post-merge validator tests.
 *
 * Verifies that post-merge validation corrects CRDT merge artifacts:
 * - Tombstone enforcement (archive wins over un-archive)
 * - Hierarchy cycle detection and breaking
 * - Sort order normalization
 * - CheckInRecord normalization
 * - FriendConnection status normalization
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { PostMergeValidator } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import type { CrdtGroup, CrdtSubsystem, CrdtInnerWorldRegion } from "../schemas/system-core.js";
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

// ── Task 1: Tombstone enforcement ────────────────────────────────────

describe("PostMergeValidator: enforceTombstones", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("re-stamps archived = true when entity is archived post-merge to ensure tombstone wins future merges", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-tomb-enforce");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-tomb-enforce", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    // After merge, entity should be archived (A's archive + B's edit both apply)
    expect(sessionA.document.members["mem_1"]?.archived).toBe(true);

    // Run tombstone enforcement — re-stamps to ensure archive wins future merges
    const validator = new PostMergeValidator();
    const { notifications } = validator.enforceTombstones(sessionA);

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
      documentId: "doc-tomb-no-stamp",
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

    const validator = new PostMergeValidator();
    const { notifications } = validator.enforceTombstones(session);

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

  it("breaks a group cycle by nulling parent of lowest-ID entity", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-cycle-fix");

    const seedEnv = sessionA.change((d) => {
      d.groups["groupA"] = makeGroup("groupA", 1);
      d.groups["groupB"] = makeGroup("groupB", 2);
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-cycle-fix", 0));

    // Create mutual parent cycle
    const envA = sessionA.change((d) => {
      const g = d.groups["groupA"];
      if (g) g.parentGroupId = s("groupB");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["groupB"];
      if (g) g.parentGroupId = s("groupA");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const { breaks } = validator.detectHierarchyCycles(sessionA);

    // Cycle should be broken
    expect(breaks.length).toBeGreaterThan(0);

    // The lowest ID entity ("groupA" < "groupB") should have its parent nulled
    expect(sessionA.document.groups["groupA"]?.parentGroupId).toBeNull();
    expect(sessionA.document.groups["groupB"]?.parentGroupId?.val).toBe("groupA");
  });

  it("breaks subsystem cycles", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-ss-cycle");

    const seedEnv = sessionA.change((d) => {
      d.subsystems["ss_a"] = makeSubsystem("ss_a");
      d.subsystems["ss_b"] = makeSubsystem("ss_b");
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-ss-cycle", 0));

    const envA = sessionA.change((d) => {
      const ss = d.subsystems["ss_a"];
      if (ss) ss.parentSubsystemId = s("ss_b");
    });
    const envB = sessionB.change((d) => {
      const ss = d.subsystems["ss_b"];
      if (ss) ss.parentSubsystemId = s("ss_a");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const { breaks } = validator.detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    // ss_a < ss_b alphabetically, so ss_a's parent gets nulled
    expect(sessionA.document.subsystems["ss_a"]?.parentSubsystemId).toBeNull();
  });

  it("breaks innerworld region cycles", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-rg-cycle");

    const seedEnv = sessionA.change((d) => {
      d.innerWorldRegions["rg_a"] = makeRegion("rg_a");
      d.innerWorldRegions["rg_b"] = makeRegion("rg_b");
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-rg-cycle", 0));

    const envA = sessionA.change((d) => {
      const rg = d.innerWorldRegions["rg_a"];
      if (rg) rg.parentRegionId = s("rg_b");
    });
    const envB = sessionB.change((d) => {
      const rg = d.innerWorldRegions["rg_b"];
      if (rg) rg.parentRegionId = s("rg_a");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const { breaks } = validator.detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    expect(sessionA.document.innerWorldRegions["rg_a"]?.parentRegionId).toBeNull();
  });

  it("returns empty array when no cycles exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: "doc-no-cycle",
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2, { parentGroupId: "grp_1" });
    });

    const validator = new PostMergeValidator();
    const { breaks } = validator.detectHierarchyCycles(session);
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
      documentId: "doc-sort-norm",
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 5);
      d.groups["grp_2"] = makeGroup("grp_2", 5);
      d.groups["grp_2"].createdAt = 900;
    });

    const validator = new PostMergeValidator();
    const { patches } = validator.normalizeSortOrder(session);

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
      documentId: "doc-sort-ok",
      sodium,
    });

    session.change((d) => {
      d.groups["grp_1"] = makeGroup("grp_1", 1);
      d.groups["grp_2"] = makeGroup("grp_2", 2);
    });

    const validator = new PostMergeValidator();
    const { patches } = validator.normalizeSortOrder(session);
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

  it("sets dismissed = false when respondedByMemberId is set and dismissed is true", () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-checkin-norm");

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
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-checkin-norm", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const { count } = validator.normalizeCheckInRecord(sessionA);

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
      documentId: "doc-checkin-ok",
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

    const validator = new PostMergeValidator();
    const { count } = validator.normalizeCheckInRecord(session);
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

  it("re-stamps accepted when status reverted to pending from accepted", () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-friend-norm");

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
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-friend-norm", 0));

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

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    // The LWW may pick B's pending status
    const validator = new PostMergeValidator();
    const { count } = validator.normalizeFriendConnection(sessionA);

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
      documentId: "doc-friend-ok",
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

    const validator = new PostMergeValidator();
    const { count } = validator.normalizeFriendConnection(session);
    expect(count).toBe(0);
  });
});

// ── Task 2: runAllValidations ──────────────────────────────────────────

describe("PostMergeValidator: runAllValidations", () => {
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
      documentId: "doc-all-valid",
      sodium,
    });

    // No issues to fix
    const validator = new PostMergeValidator();
    const result = validator.runAllValidations(session);

    expect(result.cycleBreaks).toHaveLength(0);
    expect(result.sortOrderPatches).toHaveLength(0);
    expect(result.checkInNormalizations).toBe(0);
    expect(result.friendConnectionNormalizations).toBe(0);
    expect(result.correctionEnvelopes).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("returns correctionEnvelopes and notifications when issues exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: "doc-all-with-issues",
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

    const validator = new PostMergeValidator();
    const result = validator.runAllValidations(session);

    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    // notifications should include tombstone notifications
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.notifications).toEqual(
      expect.arrayContaining([expect.objectContaining({ resolution: "lww-field" })]),
    );
  });

  it("includes cycle break and sort order notifications in result.notifications", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-notif-test");

    const seedEnv = sessionA.change((d) => {
      d.groups["grpA"] = makeGroup("grpA", 5);
      d.groups["grpB"] = makeGroup("grpB", 5);
      d.groups["grpC"] = makeGroup("grpC", 3);
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-notif-test", 0));

    const envA = sessionA.change((d) => {
      const g = d.groups["grpA"];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grpC"];
      if (g) g.parentGroupId = s("grpA");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const result = validator.runAllValidations(sessionA);

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
  });

  it("handles both sort order ties and parent cycles in same run", () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, "doc-multi-validator");

    // Seed groups with sort order ties and potential cycle
    const seedEnv = sessionA.change((d) => {
      d.groups["grpA"] = makeGroup("grpA", 5);
      d.groups["grpB"] = makeGroup("grpB", 5); // tie with grpA
      d.groups["grpC"] = makeGroup("grpC", 3);
    });
    relay.submit(seedEnv);
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince("doc-multi-validator", 0));

    // Create a cycle between grpA and grpC
    const envA = sessionA.change((d) => {
      const g = d.groups["grpA"];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups["grpC"];
      if (g) g.parentGroupId = s("grpA");
    });

    relay.submit(envA);
    relay.submit(envB);
    syncThroughRelay([sessionA, sessionB], relay);

    const validator = new PostMergeValidator();
    const result = validator.runAllValidations(sessionA);

    // Both validators should have detected issues
    expect(result.cycleBreaks.length).toBeGreaterThan(0);
    expect(result.sortOrderPatches.length).toBeGreaterThan(0);
  });
});
