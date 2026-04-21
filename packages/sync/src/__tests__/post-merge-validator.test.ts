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
  fromDoc,
} from "../factories/document-factory.js";
import {
  runAllValidations,
  enforceTombstones,
  detectHierarchyCycles,
  normalizeSortOrder,
  normalizeCheckInRecord,
  normalizeFriendConnection,
  normalizeFrontingSessions,
  normalizeTimerConfig,
  normalizeWebhookConfigs,
  ENTITY_FIELD_MAP,
  normalizeFrontingCommentAuthors,
} from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import {
  asBucketId,
  asCheckInRecordId,
  asFriendConnectionId,
  asFrontingCommentId,
  asFrontingSessionId,
  asGroupId,
  asInnerWorldRegionId,
  asMemberId,
  asSyncDocId,
  asSystemStructureEntityLinkId,
  asTimerId,
} from "./test-crypto-helpers.js";

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
      d.members[asMemberId("mem_1")] = {
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
      const m = d.members[asMemberId("mem_1")];
      if (m) {
        m.archived = true;
        m.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const m = d.members[asMemberId("mem_1")];
      if (m) {
        m.name = s("Edited Name");
        m.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // After merge, entity should be archived (A's archive + B's edit both apply)
    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);

    // Run tombstone enforcement — re-stamps to ensure archive wins future merges
    const { notifications } = enforceTombstones(sessionA);

    // After enforcement, archived should still be true
    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);
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

    const { notifications } = enforceTombstones(session);

    expect(notifications).toHaveLength(0);
    expect(session.document.members[asMemberId("mem_1")]?.archived).toBe(false);
  });

  it("skips entity types not in dirtyEntityTypes", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-dirty"),
      sodium,
    });

    // Archive a member — normally enforceTombstones would re-stamp it.
    session.change((d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Archived"),
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

    // Pass a dirty set that does NOT include "member" — no re-stamp expected.
    const { notifications, envelope } = enforceTombstones(session, new Set(["group"]));

    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });

  it("re-stamps when the dirty set does include the affected entity type", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-dirty-hit"),
      sodium,
    });

    session.change((d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Archived"),
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

    const { notifications } = enforceTombstones(session, new Set(["member"]));

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0]?.entityType).toBe("member");
  });

  it("returns no notifications and no envelope when dirty set is empty, even with archived entities present", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-tomb-empty-dirty"),
      sodium,
    });

    // Seed multiple archived entities across different types; an empty dirty
    // set must still short-circuit every scan.
    session.change((d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_1"),
        name: s("Archived"),
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
      d.groups[asGroupId("grp_archived")] = makeGroup("grp_archived", 1);
      const archivedGroup = d.groups[asGroupId("grp_archived")];
      if (archivedGroup) archivedGroup.archived = true;
    });

    const { notifications, envelope } = enforceTombstones(session, new Set());

    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
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
      d.groups[asGroupId("groupA")] = makeGroup("groupA", 1);
      d.groups[asGroupId("groupB")] = makeGroup("groupB", 2);
    });
    await relay.submit(seedEnv);
    const _r2 = await relay.getEnvelopesSince(asSyncDocId("doc-cycle-fix"), 0);
    sessionB.applyEncryptedChanges(_r2.envelopes);

    // Create mutual parent cycle
    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("groupA")];
      if (g) g.parentGroupId = s("groupB");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("groupB")];
      if (g) g.parentGroupId = s("groupA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    // Cycle should be broken
    expect(breaks.length).toBeGreaterThan(0);

    // The lowest ID entity ("groupA" < "groupB") should have its parent nulled
    expect(sessionA.document.groups[asGroupId("groupA")]?.parentGroupId).toBeNull();
    expect(sessionA.document.groups[asGroupId("groupB")]?.parentGroupId?.val).toBe("groupA");
  });

  it("breaks a second group cycle (independent from the first)", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-grp-cycle-2"));

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grpX")] = makeGroup("grpX", 1);
      d.groups[asGroupId("grpY")] = makeGroup("grpY", 2);
    });
    await relay.submit(seedEnv);
    const _r3 = await relay.getEnvelopesSince(asSyncDocId("doc-grp-cycle-2"), 0);
    sessionB.applyEncryptedChanges(_r3.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grpX")];
      if (g) g.parentGroupId = s("grpY");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grpY")];
      if (g) g.parentGroupId = s("grpX");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    // grpX < grpY alphabetically, so grpX's parent gets nulled
    expect(sessionA.document.groups[asGroupId("grpX")]?.parentGroupId).toBeNull();
  });

  it("breaks innerworld region cycles", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-rg-cycle"));

    const seedEnv = sessionA.change((d) => {
      d.innerWorldRegions[asInnerWorldRegionId("rg_a")] = makeRegion("rg_a");
      d.innerWorldRegions[asInnerWorldRegionId("rg_b")] = makeRegion("rg_b");
    });
    await relay.submit(seedEnv);
    const _r4 = await relay.getEnvelopesSince(asSyncDocId("doc-rg-cycle"), 0);
    sessionB.applyEncryptedChanges(_r4.envelopes);

    const envA = sessionA.change((d) => {
      const rg = d.innerWorldRegions[asInnerWorldRegionId("rg_a")];
      if (rg) rg.parentRegionId = s("rg_b");
    });
    const envB = sessionB.change((d) => {
      const rg = d.innerWorldRegions[asInnerWorldRegionId("rg_b")];
      if (rg) rg.parentRegionId = s("rg_a");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    expect(
      sessionA.document.innerWorldRegions[asInnerWorldRegionId("rg_a")]?.parentRegionId,
    ).toBeNull();
  });

  it("breaks a 3-node group cycle (A->B->C->A) by nulling parent of lowest-ID entity", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-3-cycle"));

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grpA")] = makeGroup("grpA", 1);
      d.groups[asGroupId("grpB")] = makeGroup("grpB", 2);
      d.groups[asGroupId("grpC")] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const seedResult = await relay.getEnvelopesSince(asSyncDocId("doc-3-cycle"), 0);
    sessionB.applyEncryptedChanges(seedResult.envelopes);

    // A sets grpA->grpB, grpB->grpC. B sets grpC->grpA. After merge: A->B->C->A cycle.
    const envA = sessionA.change((d) => {
      const gA = d.groups[asGroupId("grpA")];
      if (gA) gA.parentGroupId = s("grpB");
      const gB = d.groups[asGroupId("grpB")];
      if (gB) gB.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const gC = d.groups[asGroupId("grpC")];
      if (gC) gC.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { breaks } = detectHierarchyCycles(sessionA);

    expect(breaks.length).toBeGreaterThan(0);
    // "grpA" is the lowest-ID in the cycle, so its parent gets nulled
    expect(sessionA.document.groups[asGroupId("grpA")]?.parentGroupId).toBeNull();
    // The rest of the chain should remain intact
    expect(sessionA.document.groups[asGroupId("grpB")]?.parentGroupId?.val).toBe("grpC");
    expect(sessionA.document.groups[asGroupId("grpC")]?.parentGroupId?.val).toBe("grpA");
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
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 1);
      d.groups[asGroupId("grp_2")] = makeGroup("grp_2", 2, { parentGroupId: "grp_1" });
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
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 5);
      const grp2 = makeGroup("grp_2", 5);
      grp2.createdAt = 900;
      d.groups[asGroupId("grp_2")] = grp2;
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
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 1);
      d.groups[asGroupId("grp_2")] = makeGroup("grp_2", 2);
    });

    const { patches } = normalizeSortOrder(session);
    expect(patches).toHaveLength(0);
  });

  it("does not renumber entities under different parents with same sortOrder", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-parent-scope"),
      sodium,
    });

    session.change((d) => {
      // Two links under different parents, both sortOrder 1 — no tie within each group
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_a")] = {
        id: s("stel_a"),
        systemId: s("sys_1"),
        entityId: s("ste_a"),
        parentEntityId: s("parent_1"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_b")] = {
        id: s("stel_b"),
        systemId: s("sys_1"),
        entityId: s("ste_b"),
        parentEntityId: s("parent_2"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { patches } = normalizeSortOrder(session);
    expect(patches).toHaveLength(0);
  });

  it("renumbers tied siblings under same parent", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-same-parent"),
      sodium,
    });

    session.change((d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_a")] = {
        id: s("stel_a"),
        systemId: s("sys_1"),
        entityId: s("ste_a"),
        parentEntityId: s("parent_1"),
        sortOrder: 5,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_b")] = {
        id: s("stel_b"),
        systemId: s("sys_1"),
        entityId: s("ste_b"),
        parentEntityId: s("parent_1"),
        sortOrder: 5,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });

    const { patches } = normalizeSortOrder(session);
    expect(patches.length).toBeGreaterThan(0);

    // After normalization, sort orders should be unique within the parent group
    const linkA = session.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_a")];
    const linkB = session.document.structureEntityLinks[asSystemStructureEntityLinkId("stel_b")];
    expect(linkA?.sortOrder).not.toBe(linkB?.sortOrder);
  });

  it("handles null parentEntityId group independently", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-null-parent"),
      sodium,
    });

    session.change((d) => {
      // Root-level link (null parent)
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_root")] = {
        id: s("stel_root"),
        systemId: s("sys_1"),
        entityId: s("ste_root"),
        parentEntityId: null,
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      // Child under a parent with same sortOrder as root — no conflict across groups
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_child")] = {
        id: s("stel_child"),
        systemId: s("sys_1"),
        entityId: s("ste_child"),
        parentEntityId: s("parent_1"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { patches } = normalizeSortOrder(session);
    // No ties within either group (each group has exactly one entity)
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
    const _r5 = await relay.getEnvelopesSince(asSyncDocId("doc-checkin-norm"), 0);
    sessionB.applyEncryptedChanges(_r5.envelopes);

    // A responds, B dismisses concurrently
    const envA = sessionA.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (cr) {
        cr.respondedByMemberId = s("mem_1");
        cr.respondedAt = 1100;
      }
    });
    const envB = sessionB.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (cr) {
        cr.dismissed = true;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { count } = normalizeCheckInRecord(sessionA);

    const cr = sessionA.document.checkInRecords[asCheckInRecordId("cr_1")];
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
      d.checkInRecords[asCheckInRecordId("cr_1")] = {
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
      d.friendConnections[asFriendConnectionId("fc_1")] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: { [asBucketId("bkt_1")]: true },
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const _r6 = await relay.getEnvelopesSince(asSyncDocId("doc-friend-norm"), 0);
    sessionB.applyEncryptedChanges(_r6.envelopes);

    // B sets status to pending while A keeps accepted
    const envA = sessionA.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) fc.updatedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
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
    expect(sessionA.document.friendConnections[asFriendConnectionId("fc_1")]?.status.val).toBe(
      "accepted",
    );
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
      d.friendConnections[asFriendConnectionId("fc_1")] = {
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

// ── Task 2: FrontingSession normalization ──────────────────────────────

describe("PostMergeValidator: normalizeFrontingSessions", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("nulls endTime when endTime <= startTime and emits notification with post-merge-endtime-normalize resolution", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-endtime"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 2000,
        endTime: 1000,
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

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    expect(envelope).not.toBeNull();
    expect(session.document.sessions[sessionId]?.endTime).toBeNull();

    const endTimeNotification = notifications.find(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    expect(endTimeNotification?.entityId).toBe(sessionId);
    expect(endTimeNotification?.fieldName).toBe("endTime");
  });

  it("emits notification-only resolution when subject is missing (all null) without mutating", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-no-subject"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        startTime: 1000,
        endTime: 5000,
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
    // Null out memberId to simulate CRDT merge artifact (all subjects missing)
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    // No endTime mutation (endTime > startTime is valid)
    expect(count).toBe(0);
    expect(envelope).toBeNull();

    // But a notification-only warning for missing subject
    const subjectNotification = notifications.find((n) => n.resolution === "notification-only");
    expect(subjectNotification?.entityId).toBe(sessionId);
    expect(subjectNotification?.fieldName).toBe("subject");
  });

  it("returns count=0 and no notifications for a valid session", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-valid"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: 5000,
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

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });

  it("returns count=0 and envelope=null for empty sessions map", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-empty"),
      sodium,
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });

  it("fixes only invalid sessions in a mixed valid + invalid set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-mixed"),
      sodium,
    });

    const validId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    const invalidId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    const noSubjectId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);

    session.change((d) => {
      // Valid session: endTime > startTime, has subject
      d.sessions[validId] = {
        id: s(validId),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: 5000,
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

      // Invalid endTime: endTime <= startTime
      d.sessions[invalidId] = {
        id: s(invalidId),
        systemId: s("sys_1"),
        memberId: s("mem_2"),
        startTime: 3000,
        endTime: 2000,
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

      // Missing subject: no mutation, notification only
      d.sessions[noSubjectId] = {
        id: s(noSubjectId),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        startTime: 1000,
        endTime: 8000,
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
    // Null out memberId on noSubjectId to simulate CRDT merge artifact (all subjects missing)
    session.change((d) => {
      const target = d.sessions[noSubjectId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    // Only the endTime violation gets mutated
    expect(count).toBe(1);
    expect(envelope).not.toBeNull();

    // Invalid session had its endTime nulled
    expect(session.document.sessions[invalidId]?.endTime).toBeNull();
    // Valid session remains untouched
    expect(session.document.sessions[validId]?.endTime).toBe(5000);
    // No-subject session endTime remains untouched (it was valid)
    expect(session.document.sessions[noSubjectId]?.endTime).toBe(8000);

    // Notifications: 1 for endTime fix + 1 for missing subject
    const endTimeNotifications = notifications.filter(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    const subjectNotifications = notifications.filter((n) => n.resolution === "notification-only");
    expect(endTimeNotifications).toHaveLength(1);
    expect(endTimeNotifications[0]?.entityId).toBe(invalidId);
    expect(subjectNotifications).toHaveLength(1);
    expect(subjectNotifications[0]?.entityId).toBe(noSubjectId);
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
    expect(result.timerConfigNormalizations).toBe(0);
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
      d.members[asMemberId("mem_1")] = {
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
      d.groups[asGroupId("grpA")] = makeGroup("grpA", 5);
      d.groups[asGroupId("grpB")] = makeGroup("grpB", 5);
      d.groups[asGroupId("grpC")] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r7 = await relay.getEnvelopesSince(asSyncDocId("doc-notif-test"), 0);
    sessionB.applyEncryptedChanges(_r7.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grpA")];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grpC")];
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
      d.groups[asGroupId("grpA")] = makeGroup("grpA", 5);
      d.groups[asGroupId("grpB")] = makeGroup("grpB", 5); // tie with grpA
      d.groups[asGroupId("grpC")] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r8 = await relay.getEnvelopesSince(asSyncDocId("doc-multi-validator"), 0);
    sessionB.applyEncryptedChanges(_r8.envelopes);

    // Create a cycle between grpA and grpC
    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grpA")];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grpC")];
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

  it("normalizes invalid timer configs via runAllValidations dispatch", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-all-valid"),
      sodium,
    });

    // Add a timer with invalid intervalMinutes
    session.change((d) => {
      d.timers[asTimerId("tmr_invalid")] = {
        id: s("tmr_invalid"),
        systemId: s("sys_1"),
        intervalMinutes: -5,
        wakingHoursOnly: false,
        wakingStart: null,
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    // Timer should be disabled
    expect(session.document.timers[asTimerId("tmr_invalid")]?.enabled).toBe(false);
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
      d.members[asMemberId("mem_1")] = {
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
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 5);
      const grp2 = makeGroup("grp_2", 5);
      grp2.createdAt = 900;
      d.groups[asGroupId("grp_2")] = grp2;
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

  it("counts frontingCommentAuthorIssues for authorless comments in fronting doc", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-comment-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("authorless after merge"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(commentId)];
      if (target) target.memberId = null;
    });

    const result = runAllValidations(session);

    expect(result.frontingCommentAuthorIssues).toBe(1);
    expect(result.notifications.some((n) => n.entityType === "fronting-comment")).toBe(true);
  });
});

describe("PostMergeValidator: normalizeFrontingCommentAuthors", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("emits notification-only when all author fields are null", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-authorless"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        customFrontId: null,
        structureEntityId: null,
        content: s("test comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    // Null out memberId to simulate CRDT merge artifact
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(commentId)];
      if (target) target.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.resolution).toBe("notification-only");
    expect(notifications[0]?.entityType).toBe("fronting-comment");
    expect(notifications[0]?.entityId).toBe(commentId);
    expect(notifications[0]?.fieldName).toBe("author");
  });

  it("returns no notifications when at least one author field is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-valid-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        customFrontId: null,
        structureEntityId: null,
        content: s("test comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("detects multiple authorless comments in a single pass", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-multi-authorless"),
      sodium,
    });

    const id1 = `fc_${crypto.randomUUID()}`;
    const id2 = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(id1)] = {
        id: s(id1),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("comment 1"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(id2)] = {
        id: s(id2),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("comment 2"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const c1 = d.comments[asFrontingCommentId(id1)];
      const c2 = d.comments[asFrontingCommentId(id2)];
      if (c1) c1.memberId = null;
      if (c2) c2.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(2);
    expect(notifications.every((n) => n.resolution === "notification-only")).toBe(true);
  });

  it("returns no notifications when document has no comments field", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sysCore-no-comments"),
      sodium,
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("returns no notifications when only customFrontId is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-customfront-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: s("cf_1"),
        structureEntityId: null,
        content: s("custom front comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("returns no notifications when only structureEntityId is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-entity-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: null,
        structureEntityId: s("ste_1"),
        content: s("entity comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("detects only authorless comments in a mixed set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-mixed-authors"),
      sodium,
    });

    const validMemberId = `fc_${crypto.randomUUID()}`;
    const validCustomFrontId = `fc_${crypto.randomUUID()}`;
    const authorlessId = `fc_${crypto.randomUUID()}`;

    session.change((d) => {
      d.comments[asFrontingCommentId(validMemberId)] = {
        id: s(validMemberId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        customFrontId: null,
        structureEntityId: null,
        content: s("member comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(validCustomFrontId)] = {
        id: s(validCustomFrontId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: s("cf_1"),
        structureEntityId: null,
        content: s("custom front comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(authorlessId)] = {
        id: s(authorlessId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("will become authorless"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(authorlessId)];
      if (target) target.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.entityId).toBe(authorlessId);
  });
});

// ── Branch-coverage additions ─────────────────────────────────────────
// These suites cover previously uncovered branches in post-merge-validator.ts.

// Webhook/timer document shape for tests that need webhookConfigs.
interface _WebhookConfigShape {
  url: Automerge.ImmutableString;
  eventTypes: Automerge.ImmutableString[];
  enabled: boolean;
}
interface _WebhookTestDocument {
  timers: Record<string, unknown>;
  webhookConfigs: Record<string, _WebhookConfigShape>;
}

function makeWebhookSession(
  keys: DocumentKeys,
  docId: string,
  sodium: SodiumAdapter,
): EncryptedSyncSession<_WebhookTestDocument> {
  const base = fromDoc({ timers: {}, webhookConfigs: {} });
  return new EncryptedSyncSession<_WebhookTestDocument>({
    doc: Automerge.clone(base) as Automerge.Doc<_WebhookTestDocument>,
    keys,
    documentId: asSyncDocId(docId),
    sodium,
  });
}

// ── normalizeFriendConnection: uncovered branches ─────────────────────

describe("normalizeFriendConnection: additional branch coverage", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("fixes pending connection that has visibility-only evidence (no assigned buckets)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-vis-only"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_vis")] = {
        id: s("fc_vis"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);

    expect(count).toBe(1);
    expect(session.document.friendConnections[asFriendConnectionId("fc_vis")]?.status.val).toBe(
      "accepted",
    );
  });

  it("does not fix pending connection with empty buckets and empty visibility", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-no-evidence"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_noev")] = {
        id: s("fc_noev"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, envelope } = normalizeFriendConnection(session);

    expect(count).toBe(0);
    expect(envelope).toBeNull();
  });

  it("handles invalid JSON in visibility gracefully (catch branch sets hasVisibility=false)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-bad-json"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_badvis")] = {
        id: s("fc_badvis"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s("NOT_VALID_JSON{{{"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    // Invalid JSON + no buckets → hasVisibility=false, hasAssignedBuckets=false → no fix
    const { count, envelope } = normalizeFriendConnection(session);
    expect(count).toBe(0);
    expect(envelope).toBeNull();
  });

  it("fixes pending connection with both buckets and valid visibility", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-both"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_both")] = {
        id: s("fc_both"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: { [asBucketId("bkt_x")]: true },
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);
    expect(count).toBe(1);
  });
});

// ── runAllValidations: checkIn + fronting + friendConnection branches ──

describe("runAllValidations: checkIn, fronting, and friendConnection dispatch", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("populates checkInNormalizations and emits batch notification when check-in record needs fix", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-checkin-fix"),
      sodium,
    });

    session.change((d) => {
      d.checkInRecords[asCheckInRecordId("cr_fix")] = {
        id: s("cr_fix"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: s("mem_1"),
        respondedAt: 1100,
        dismissed: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const result = runAllValidations(session);

    expect(result.checkInNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-checkin-normalize")).toBe(
      true,
    );
  });

  it("populates frontingSessionNormalizations and emits envelope when endTime is invalid", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-fronting-fix"),
      sodium,
    });

    const fsId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[fsId] = {
        id: s(fsId),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 5000,
        endTime: 1000,
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

    const result = runAllValidations(session);

    expect(result.frontingSessionNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
  });

  it("populates friendConnectionNormalizations and emits batch notification when connection needs fix", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-friend-fix"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_run")] = {
        id: s("fc_run"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: { [asBucketId("bkt_y")]: true },
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const result = runAllValidations(session);

    expect(result.friendConnectionNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-friend-status")).toBe(
      true,
    );
  });
});

// ── normalizeWebhookConfigs: url/eventType branch coverage ────────────

describe("normalizeWebhookConfigs: additional branch coverage", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("skips URL check when config url field is not an object (urlVal=null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-url-null", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_noobj"] = {
        // @ts-expect-error -- testing non-object url to hit urlVal=null branch
        url: "https://example.com/hook",
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    // urlVal is null (url is not an object), so URL check is skipped entirely;
    // eventTypes are valid so no notifications.
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for null event type value (typeof check returns null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-null-evttype", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_nullevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- null eventType to hit the val=null → invalid path
        eventTypes: [null],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });

  it("validates plain string event types (typeof eventType === string branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-str-evt-valid", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_strvalid"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- plain string eventType to hit typeof === string branch
        eventTypes: ["member.created"],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for invalid plain string event type (typeof string, bad value)", () => {
    const session = makeWebhookSession(keys, "doc-wh-str-evt-bad", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_strbad"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- plain string eventType to hit typeof === string bad-value path
        eventTypes: ["completely.unknown.event"],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });
});

// ── normalizeTimerConfig: empty timers map (no-timers-field path) ──────

describe("normalizeTimerConfig: no timers field branch", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("returns count=0 when document has no timers field", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-no-field"),
      sodium,
    });

    const result = normalizeTimerConfig(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });
});

// ── Self-referencing parent cycle ─────────────────────────────────────

describe("detectHierarchyCycles: self-referencing parent", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("breaks a self-referencing group cycle (parentId points to itself)", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-self-cycle"),
      sodium,
    });

    session.change((d) => {
      d.groups[asGroupId("grpSelf")] = makeGroup("grpSelf", 1, {
        parentGroupId: "grpSelf",
      });
    });

    const { breaks } = detectHierarchyCycles(session);

    expect(breaks).toHaveLength(1);
    expect(breaks[0]?.entityId).toBe("grpSelf");
    expect(breaks[0]?.formerParentId).toBe("grpSelf");
    expect(session.document.groups[asGroupId("grpSelf")]?.parentGroupId).toBeNull();
  });

  it("breaks a self-referencing inner world region cycle", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-self-cycle-region"),
      sodium,
    });

    session.change((d) => {
      d.innerWorldRegions[asInnerWorldRegionId("rg_self")] = makeRegion("rg_self", "rg_self");
    });

    const { breaks } = detectHierarchyCycles(session);

    expect(breaks).toHaveLength(1);
    expect(breaks[0]?.entityId).toBe("rg_self");
    expect(
      session.document.innerWorldRegions[asInnerWorldRegionId("rg_self")]?.parentRegionId,
    ).toBeNull();
  });
});

// ── normalizeTimerConfig: edge cases ──────────────────────────────────

describe("normalizeTimerConfig: edge case branches", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("disables timer when intervalMinutes is 0", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-zero-interval"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_zero")] = {
        id: s("tmr_zero"),
        systemId: s("sys_1"),
        intervalMinutes: 0,
        wakingHoursOnly: false,
        wakingStart: null,
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_zero")]?.enabled).toBe(false);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.fieldName).toBe("intervalMinutes");
    expect(notifications[0]?.summary).toContain("0");
  });

  it("disables timer when intervalMinutes is negative", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-neg-interval"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_neg")] = {
        id: s("tmr_neg"),
        systemId: s("sys_1"),
        intervalMinutes: -10,
        wakingHoursOnly: false,
        wakingStart: null,
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_neg")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("intervalMinutes");
  });

  it("disables timer when wakingStart equals wakingEnd (same time)", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-same-waking"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_same")] = {
        id: s("tmr_same"),
        systemId: s("sys_1"),
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("08:00"),
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_same")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
    expect(notifications[0]?.summary).toContain("08:00");
  });

  it("disables timer when wakingHoursOnly is true but wakingStart is null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-null-start"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_nullstart")] = {
        id: s("tmr_nullstart"),
        systemId: s("sys_1"),
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: s("22:00"),
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_nullstart")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
    expect(notifications[0]?.summary).toContain("null");
  });

  it("disables timer when wakingHoursOnly is true but wakingEnd is null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-null-end"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_nullend")] = {
        id: s("tmr_nullend"),
        systemId: s("sys_1"),
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_nullend")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
  });

  it("disables timer when wakingHoursOnly is true but both start and end are null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-both-null"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_bothnull")] = {
        id: s("tmr_bothnull"),
        systemId: s("sys_1"),
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_bothnull")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
  });

  it("skips archived timers even if they have invalid intervalMinutes", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-archived-skip"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_arch")] = {
        id: s("tmr_arch"),
        systemId: s("sys_1"),
        intervalMinutes: -5,
        wakingHoursOnly: false,
        wakingStart: null,
        wakingEnd: null,
        promptText: s("Test"),
        enabled: true,
        archived: true,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, notifications } = normalizeTimerConfig(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("does not disable a valid timer (positive interval, valid waking hours)", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-valid"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_ok")] = {
        id: s("tmr_ok"),
        systemId: s("sys_1"),
        intervalMinutes: 60,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, envelope } = normalizeTimerConfig(session);

    expect(count).toBe(0);
    expect(envelope).toBeNull();
    expect(session.document.timers[asTimerId("tmr_ok")]?.enabled).toBe(true);
  });
});

// ── normalizeWebhookConfigs: additional edge cases ────────────────────

describe("normalizeWebhookConfigs: object/number eventType and protocol edge cases", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("generates notification for non-string non-object eventType (number hits null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-num-evttype", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_numevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- number eventType to hit the else branch (val=null)
        eventTypes: [42],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
    expect(result.notifications[0]?.summary).toContain("null");
  });

  it("generates notification for boolean eventType (non-string non-object-with-val)", () => {
    const session = makeWebhookSession(keys, "doc-wh-bool-evttype", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_boolevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- boolean eventType to hit the else branch (val=null)
        eventTypes: [true],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.summary).toContain("null");
  });

  it("generates notification for non-HTTP(S) URL protocol (ftp://)", () => {
    const session = makeWebhookSession(keys, "doc-wh-ftp-url", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_ftp"] = {
        url: s("ftp://example.com/hook"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.summary).toContain("non-HTTP(S)");
  });

  it("generates notification for invalid URL format (malformed string)", () => {
    const session = makeWebhookSession(keys, "doc-wh-bad-url", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_badurl"] = {
        url: s("not a valid url at all"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.summary).toContain("invalid URL format");
  });

  it("generates notification for object eventType without val property (val=null)", () => {
    const session = makeWebhookSession(keys, "doc-wh-obj-no-val", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_objnoval"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- object without val property to hit typeof=object but no 'val' branch
        eventTypes: [{ something: "else" }],
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });
});

// ── normalizeFrontingSessions: additional branch coverage ─────────────

describe("normalizeFrontingSessions: additional edge cases", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("nulls endTime when endTime exactly equals startTime", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-eq-endtime"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 3000,
        endTime: 3000,
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

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    expect(envelope).not.toBeNull();
    expect(session.document.sessions[sessionId]?.endTime).toBeNull();
    expect(notifications.some((n) => n.resolution === "post-merge-endtime-normalize")).toBe(true);
  });

  it("emits orphan notification for session with only customFrontId set (no member/structureEntity)", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-custom-only"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        customFrontId: s("cf_1"),
        structureEntityId: s(""),
        startTime: 1000,
        endTime: 5000,
        comment: s(""),
        positionality: s(""),
        outtrigger: s(""),
        outtriggerSentiment: s(""),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    // Null out memberId to exercise the customFrontId-only path
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    // customFrontId is set so subject constraint is satisfied — no notification
    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("emits orphan notification for session with only structureEntityId set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-entity-only"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        customFrontId: s("cf_placeholder"),
        structureEntityId: s("ste_1"),
        startTime: 1000,
        endTime: 5000,
        comment: s(""),
        positionality: s(""),
        outtrigger: s(""),
        outtriggerSentiment: s(""),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    // Null out memberId and customFrontId to exercise structureEntityId-only path
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate CRDT merge state
      if (target) target.memberId = null;
      if (target) target.customFrontId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    // structureEntityId is set so subject constraint is satisfied — no notification
    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("handles both endTime violation and orphan subject on the same session", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-both-violations"),
      sodium,
    });

    const sessionId = asFrontingSessionId(`fs_${crypto.randomUUID()}`);
    session.change((d) => {
      d.sessions[sessionId] = {
        id: s(sessionId),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        customFrontId: null,
        structureEntityId: null,
        startTime: 5000,
        endTime: 2000,
        comment: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    // Null out memberId to make it an orphan too
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    // Should have both an endTime notification and a subject notification
    const endTimeNotif = notifications.filter(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    const subjectNotif = notifications.filter((n) => n.resolution === "notification-only");
    expect(endTimeNotif).toHaveLength(1);
    expect(subjectNotif).toHaveLength(1);
  });
});

// ── runAllValidations: onError callback ─────────────────────────────

describe("runAllValidations: onError callback invocation", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("dispatches webhook config validation via runAllValidations and reports issues", () => {
    const session = makeWebhookSession(keys, "doc-run-webhook-dispatch", sodium);

    session.change((d) => {
      d.webhookConfigs["wh_dispatch"] = {
        url: s("ftp://bad-protocol.example.com"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });

    const result = runAllValidations(session as EncryptedSyncSession<unknown>);

    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.fieldName === "url")).toBe(true);
  });

  it("dispatches timer config validation via runAllValidations for waking-hours edge case", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-timer-waking"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_waking")] = {
        id: s("tmr_waking"),
        systemId: s("sys_1"),
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: s("10:00"),
        wakingEnd: s("10:00"),
        promptText: s("Test"),
        enabled: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.fieldName === "wakingHours")).toBe(true);
    // No errors on successful validation
    expect(errorMessages).toHaveLength(0);
  });
});
