/**
 * Post-merge validator — sort-order normalization tests.
 *
 * Covers:
 *   - normalizeSortOrder: tie detection, parent-scoped partitioning, re-assignment
 *   - normalizeSortOrder edge cases: no-change branch, corrupt parentEntityId,
 *     null/parentEntityId grouping, missing-field early return
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { normalizeSortOrder } from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { makeGroup, makeKeys, s, setSodium } from "./helpers/validator-fixtures.js";
import { asGroupId, asSyncDocId, asSystemStructureEntityLinkId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeSortOrder ────────────────────────────────────────────────

describe("PostMergeValidator: normalizeSortOrder", () => {
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

// ── normalizeSortOrder: edge cases ────────────────────────────────────

describe("PostMergeValidator: normalizeSortOrder edge cases", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("issues no patch when an entity already sits at its computed position", () => {
    // Hits the `if (entity.sortOrder !== newOrder)` false branch — at least
    // one tied entity, after deterministic sort, ends up at its existing
    // sortOrder so no patch is emitted for it.
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-no-change"),
      sodium,
    });

    session.change((d) => {
      // Two siblings with sortOrder 1 — the first by createdAt/id stays at 1.
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_a")] = {
        id: s("stel_a"),
        systemId: s("sys_1"),
        entityId: s("ste_a"),
        parentEntityId: s("parent_x"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_b")] = {
        id: s("stel_b"),
        systemId: s("sys_1"),
        entityId: s("ste_b"),
        parentEntityId: s("parent_x"),
        sortOrder: 1,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });

    const { patches } = normalizeSortOrder(session);

    // Exactly one entity needed renumbering (the second tied sibling).
    // The first entity's sortOrder already matched newOrder=1, so no patch.
    expect(patches).toHaveLength(1);
    expect(patches[0]?.entityId).toBe("stel_b");
    expect(patches[0]?.newSortOrder).toBe(2);
  });

  it("treats a non-null non-ImmutableString sortGroupField value as the null group", () => {
    // Hits the `else { key = NULL_GROUP; }` branch in partitionByGroupField —
    // a corrupt entity whose parentEntityId is a primitive instead of an
    // ImmutableString or null.
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-corrupt-group"),
      sodium,
    });

    session.change((d) => {
      // Inject a corrupt link via a Record view so we can store a primitive
      // parentEntityId — the runtime branch handles this defensively.
      const links: Record<string, unknown> = d.structureEntityLinks;
      links["stel_corrupt"] = {
        id: s("stel_corrupt"),
        systemId: s("sys_1"),
        entityId: s("ste_corrupt"),
        parentEntityId: 42,
        sortOrder: 5,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      links["stel_corrupt2"] = {
        id: s("stel_corrupt2"),
        systemId: s("sys_1"),
        entityId: s("ste_corrupt2"),
        parentEntityId: 42,
        sortOrder: 5,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });

    // Ties under the synthetic NULL_GROUP partition are renumbered.
    const { patches } = normalizeSortOrder(session);
    expect(patches.length).toBeGreaterThan(0);
  });

  it("returns no patches when sortable strategies have no entityMap (missing-field early return)", () => {
    // Privacy-config docs have no `structureEntityLinks` etc., so every
    // sortable strategy hits `if (!entityMap) continue`.
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sort-no-fields"),
      sodium,
    });

    const result = normalizeSortOrder(session as EncryptedSyncSession<unknown>);

    expect(result.patches).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });
});
