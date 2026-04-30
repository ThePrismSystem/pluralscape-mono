/**
 * Post-merge validator — hierarchy cycle detection tests.
 *
 * Covers:
 *   - detectHierarchyCycles: group cycles (2-node, 3-node, self-referencing)
 *   - detectHierarchyCycles: innerworld region cycles
 *   - detectHierarchyCycles: no-cycle, orphan-parent, and self-reference edge cases
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createSystemCoreDocument } from "../factories/document-factory.js";
import { detectHierarchyCycles } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import {
  makeGroup,
  makeKeys,
  makeSessions,
  makeRegion,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asGroupId, asInnerWorldRegionId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── detectHierarchyCycles ─────────────────────────────────────────────

describe("PostMergeValidator: detectHierarchyCycles", () => {
  let relay: EncryptedRelay;

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
    const seedReplay = await relay.getEnvelopesSince(asSyncDocId("doc-cycle-fix"), 0);
    sessionB.applyEncryptedChanges(seedReplay.envelopes);

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
    const seedReplay = await relay.getEnvelopesSince(asSyncDocId("doc-grp-cycle-2"), 0);
    sessionB.applyEncryptedChanges(seedReplay.envelopes);

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
    const seedReplay = await relay.getEnvelopesSince(asSyncDocId("doc-rg-cycle"), 0);
    sessionB.applyEncryptedChanges(seedReplay.envelopes);

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

// ── Self-referencing parent cycle ─────────────────────────────────────

describe("detectHierarchyCycles: self-referencing parent", () => {
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

// ── Hierarchy edge cases ──────────────────────────────────────────────

describe("PostMergeValidator: detectHierarchyCycles edge cases", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("ignores entities whose parent points to a non-existent entity", () => {
    // Hits the `if (current !== null && !(current in entityMap)) current = null;`
    // branch — group has parentGroupId pointing to a missing entity.
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-orphan-parent"),
      sodium,
    });

    session.change((d) => {
      d.groups[asGroupId("grp_orphan")] = makeGroup("grp_orphan", 1, {
        parentGroupId: "grp_does_not_exist",
      });
    });

    const { breaks } = detectHierarchyCycles(session);

    // No cycle — orphan parent is treated as "no parent" and walk terminates.
    expect(breaks).toHaveLength(0);
  });
});
