import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { syncThroughRelay } from "../sync-session.js";

import {
  getSodium,
  makeGroup,
  makeKeys,
  makeSessions,
  s,
} from "./helpers/conflict-resolution-fixtures.js";
import { asGroupId, asInnerWorldRegionId, asSyncDocId } from "./test-crypto-helpers.js";

import type { CrdtInnerWorldRegion } from "../schemas/system-core.js";
import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

function makeRegion(id: string, parentId?: string): CrdtInnerWorldRegion {
  return {
    id: s(id),
    systemId: s("sys_1"),
    name: s(id),
    description: null,
    parentRegionId: parentId !== undefined ? s(parentId) : null,
    visual: s("{}"),
    boundaryData: s("[]"),
    accessType: s("open"),
    gatekeeperMemberIds: s("[]"),
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

// ── Category 4: Concurrent re-parenting creating cycles ───────────────
//
// After merge, both parentGroupId fields are set, creating a cycle in the
// group hierarchy. Post-merge DFS cycle detection is application-layer
// (specified in sync-80bn — not yet implemented).

describe("Category 4: concurrent re-parenting creating cycles", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("4a — concurrent cross-parent writes both apply, producing a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-004"), sodium);

    // Seed two root groups (no parent)
    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("groupA")] = makeGroup("groupA", 1);
      d.groups[asGroupId("groupB")] = makeGroup("groupB", 2);
    });
    await relay.submit(seedEnv);
    const _r5 = await relay.getEnvelopesSince(asSyncDocId("doc-cr-004"), 0);
    sessionB.applyEncryptedChanges(_r5.envelopes);

    // A: groupA.parentGroupId = groupB
    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("groupA")];
      if (g) {
        g.parentGroupId = s("groupB");
        g.updatedAt = 2000;
      }
    });
    // B: groupB.parentGroupId = groupA (concurrent — cycle-forming)
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("groupB")];
      if (g) {
        g.parentGroupId = s("groupA");
        g.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge
    expect(sessionA.document).toEqual(sessionB.document);

    // Both parentGroupId values are set — cycle is present in merged state.
    // Post-merge cycle detection (DFS traversal) is application-layer.
    expect(sessionA.document.groups[asGroupId("groupA")]?.parentGroupId?.val).toBe("groupB");
    expect(sessionA.document.groups[asGroupId("groupB")]?.parentGroupId?.val).toBe("groupA");
  });
});

// ── Group/region hierarchy cycle detection ─────────────────────────────

describe("Hierarchy cycles: groups and innerworld regions", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("concurrent cross-reparenting of groups produces a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cycle-grp"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grp_a")] = makeGroup("grp_a", 1);
      d.groups[asGroupId("grp_b")] = makeGroup("grp_b", 2);
    });
    await relay.submit(seedEnv);
    const _r14 = await relay.getEnvelopesSince(asSyncDocId("doc-cycle-grp"), 0);
    sessionB.applyEncryptedChanges(_r14.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grp_a")];
      if (g) {
        g.parentGroupId = s("grp_b");
        g.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grp_b")];
      if (g) {
        g.parentGroupId = s("grp_a");
        g.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    expect(sessionA.document.groups[asGroupId("grp_a")]?.parentGroupId?.val).toBe("grp_b");
    expect(sessionA.document.groups[asGroupId("grp_b")]?.parentGroupId?.val).toBe("grp_a");
  });

  it("concurrent cross-reparenting of innerworld regions produces a detectable cycle", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cycle-iw"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.innerWorldRegions[asInnerWorldRegionId("rg_a")] = makeRegion("rg_a");
      d.innerWorldRegions[asInnerWorldRegionId("rg_b")] = makeRegion("rg_b");
    });
    await relay.submit(seedEnv);
    const _r15 = await relay.getEnvelopesSince(asSyncDocId("doc-cycle-iw"), 0);
    sessionB.applyEncryptedChanges(_r15.envelopes);

    const envA = sessionA.change((d) => {
      const rg = d.innerWorldRegions[asInnerWorldRegionId("rg_a")];
      if (rg) {
        rg.parentRegionId = s("rg_b");
        rg.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const rg = d.innerWorldRegions[asInnerWorldRegionId("rg_b")];
      if (rg) {
        rg.parentRegionId = s("rg_a");
        rg.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    expect(
      sessionA.document.innerWorldRegions[asInnerWorldRegionId("rg_a")]?.parentRegionId?.val,
    ).toBe("rg_b");
    expect(
      sessionA.document.innerWorldRegions[asInnerWorldRegionId("rg_b")]?.parentRegionId?.val,
    ).toBe("rg_a");
  });
});
