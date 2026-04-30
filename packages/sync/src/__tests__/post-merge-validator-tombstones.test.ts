/**
 * Post-merge validator — tombstone enforcement and ENTITY_FIELD_MAP tests.
 *
 * Covers:
 *   - ENTITY_FIELD_MAP derivation from CRDT strategies
 *   - enforceTombstones: re-stamp, dirty-set filtering, empty-dirty short-circuit
 *   - validateBucketContentTags: unknown entityType drop, known entityType pass,
 *     runAllValidations dispatch, missing-field early return,
 *     ImmutableString/no-val/non-string-val/primitive/null entityType shapes
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import {
  ENTITY_FIELD_MAP,
  enforceTombstones,
  runAllValidations,
  validateBucketContentTags,
} from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import {
  makeArchivedMember,
  makeActiveMember,
  makeGroup,
  makeKeys,
  makeSessions,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asGroupId, asMemberId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

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

// ── enforceTombstones ─────────────────────────────────────────────────

describe("PostMergeValidator: enforceTombstones", () => {
  let relay: EncryptedRelay;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("re-stamps archived = true when entity is archived post-merge to ensure tombstone wins future merges", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-tomb-enforce"));

    const seedEnv = sessionA.change((d) => {
      d.members[asMemberId("mem_1")] = makeActiveMember("mem_1");
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

    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);

    const { notifications } = enforceTombstones(sessionA);

    expect(sessionA.document.members[asMemberId("mem_1")]?.archived).toBe(true);
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
      d.members[asMemberId("mem_1")] = makeActiveMember("mem_1");
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
    session.change((d) => {
      d.members[asMemberId("mem_1")] = makeArchivedMember("mem_1");
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
      d.members[asMemberId("mem_1")] = makeArchivedMember("mem_1");
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

    // Seed multiple archived entities; an empty dirty set must short-circuit every scan.
    session.change((d) => {
      d.members[asMemberId("mem_1")] = makeArchivedMember("mem_1");
      d.groups[asGroupId("grp_archived")] = makeGroup("grp_archived", 1);
      const g = d.groups[asGroupId("grp_archived")];
      if (g) g.archived = true;
    });

    const { notifications, envelope } = enforceTombstones(session, new Set());

    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });
});

// ── validateBucketContentTags ─────────────────────────────────────────

describe("PostMergeValidator: validateBucketContentTags", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("drops bucket-content-tag entries with unknown entityType", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-drop"),
      sodium,
    });
    session.change((d) => {
      d.contentTags["member_mem_1_bkt_1"] = {
        entityType: "member",
        entityId: asMemberId("mem_1"),
        bucketId: s("bkt_1"),
      };
      const tags: Record<string, unknown> = d.contentTags;
      tags["future-thing_xyz_bkt_1"] = {
        entityType: "future-thing",
        entityId: "xyz",
        bucketId: s("bkt_1"),
      };
    });

    const result = validateBucketContentTags(session);

    expect(result.count).toBe(1);
    expect(result.envelope).not.toBeNull();
    expect(session.document.contentTags["member_mem_1_bkt_1"]?.entityType).toBe("member");
    expect(session.document.contentTags["future-thing_xyz_bkt_1"]).toBeUndefined();
    expect(
      result.notifications.some(
        (n) =>
          n.entityType === "bucket-content-tag" &&
          n.entityId === "future-thing_xyz_bkt_1" &&
          n.fieldName === "entityType",
      ),
    ).toBe(true);
  });

  it("returns 0 and no envelope when all entityTypes are known", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-ok"),
      sodium,
    });
    session.change((d) => {
      d.contentTags["member_mem_1_bkt_1"] = {
        entityType: "member",
        entityId: asMemberId("mem_1"),
        bucketId: s("bkt_1"),
      };
      d.contentTags["group_grp_1_bkt_1"] = {
        entityType: "group",
        entityId: asGroupId("grp_1"),
        bucketId: s("bkt_1"),
      };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("runAllValidations reports bucketContentTagDrops on privacy-config docs", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-runall"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["bogus_x_bkt_1"] = { entityType: "bogus", entityId: "x", bucketId: s("bkt_1") };
    });
    const result = runAllValidations(session);
    expect(result.bucketContentTagDrops).toBe(1);
    expect(session.document.contentTags["bogus_x_bkt_1"]).toBeUndefined();
  });

  it("returns count=0 when document has no contentTags field", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-no-field"),
      sodium,
    });
    const result = validateBucketContentTags(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });
});

// ── validateBucketContentTags: entityType runtime shape branches ───────

describe("PostMergeValidator: validateBucketContentTags entityType shapes", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("accepts entityType wrapped in ImmutableString (object with string val)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-immutable-str"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["mem_immutable"] = {
        entityType: s("member"),
        entityId: asMemberId("mem_immut"),
        bucketId: s("bkt_1"),
      };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });

  it("drops entries whose entityType object has no `val` key", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-noval"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["bad_noval"] = { entityType: { other: "field" }, entityId: "x", bucketId: s("bkt_1") };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(1);
    expect(result.notifications[0]?.summary).toContain("<missing>");
  });

  it("drops entries whose entityType object has a non-string `val`", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-numval"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["bad_numval"] = { entityType: { val: 42 }, entityId: "x", bucketId: s("bkt_1") };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(1);
    expect(result.notifications[0]?.summary).toContain("<missing>");
  });

  it("drops entries whose entityType is a primitive non-string non-object", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-primitive"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["bad_primitive"] = { entityType: 99, entityId: "x", bucketId: s("bkt_1") };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(1);
    expect(result.notifications[0]?.summary).toContain("<missing>");
  });

  it("drops entries whose entityType is null (object-branch null guard)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-bct-null-type"),
      sodium,
    });
    session.change((d) => {
      const tags: Record<string, unknown> = d.contentTags;
      tags["bad_null"] = { entityType: null, entityId: "x", bucketId: s("bkt_1") };
    });
    const result = validateBucketContentTags(session);
    expect(result.count).toBe(1);
    expect(result.notifications[0]?.summary).toContain("<missing>");
  });
});
