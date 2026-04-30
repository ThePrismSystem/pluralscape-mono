import * as Automerge from "@automerge/automerge";
import { beforeEach, describe, expect, it } from "vitest";

import { makeSystemCoreDoc, s } from "./helpers/schema-fixtures.js";
import {
  asSystemStructureEntityAssociationId,
  asSystemStructureEntityLinkId,
  asSystemStructureEntityMemberLinkId,
} from "./test-crypto-helpers.js";

import type { SystemCoreDocument } from "../schemas/system-core.js";

// ── SystemCoreDocument: structure entity link / member link / association ─

describe("SystemCoreDocument structure entity link types", () => {
  let doc: Automerge.Doc<SystemCoreDocument>;

  beforeEach(() => {
    doc = makeSystemCoreDoc();
  });

  it("creates entity links with all fields", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")] = {
        id: s("stel_1"),
        systemId: s("sys_test"),
        entityId: s("ste_1"),
        parentEntityId: s("ste_parent"),
        sortOrder: 0,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.entityId.val).toBe(
      "ste_1",
    );
    expect(
      doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.parentEntityId?.val,
    ).toBe("ste_parent");
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.sortOrder).toBe(0);
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.archived).toBe(false);
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.updatedAt).toBe(1000);
  });

  it("entity link supports null parentEntityId (root)", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_root")] = {
        id: s("stel_root"),
        systemId: s("sys_test"),
        entityId: s("ste_root"),
        parentEntityId: null,
        sortOrder: 0,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(
      doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_root")]?.parentEntityId,
    ).toBeNull();
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_root")]?.entityId.val).toBe(
      "ste_root",
    );
  });

  it("entity link sortOrder is mutable via LWW", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")] = {
        id: s("stel_1"),
        systemId: s("sys_test"),
        entityId: s("ste_1"),
        parentEntityId: null,
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    doc = Automerge.change(doc, (d) => {
      const link = d.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")];
      if (link) {
        link.sortOrder = 42;
        link.updatedAt = 2000;
      }
    });
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.sortOrder).toBe(42);
    expect(doc.structureEntityLinks[asSystemStructureEntityLinkId("stel_1")]?.updatedAt).toBe(2000);
  });

  it("creates member links with all fields", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")] = {
        id: s("steml_1"),
        systemId: s("sys_test"),
        parentEntityId: s("ste_1"),
        memberId: s("mem_1"),
        sortOrder: 100,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    expect(
      doc.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]?.memberId.val,
    ).toBe("mem_1");
    expect(
      doc.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]?.parentEntityId
        ?.val,
    ).toBe("ste_1");
    expect(
      doc.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]?.sortOrder,
    ).toBe(100);
    expect(
      doc.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]?.archived,
    ).toBe(false);
  });

  it("member link parentEntityId mutable via LWW", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")] = {
        id: s("steml_1"),
        systemId: s("sys_test"),
        parentEntityId: s("ste_1"),
        memberId: s("mem_1"),
        sortOrder: 0,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    doc = Automerge.change(doc, (d) => {
      const link = d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")];
      if (link) {
        link.parentEntityId = s("ste_2");
        link.updatedAt = 2000;
      }
    });
    expect(
      doc.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_1")]?.parentEntityId
        ?.val,
    ).toBe("ste_2");
  });

  it("creates associations with all fields including archived", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_1")] = {
        id: s("stea_1"),
        systemId: s("sys_test"),
        sourceEntityId: s("ste_1"),
        targetEntityId: s("ste_2"),
        archived: false,
        createdAt: 3000,
        updatedAt: 3000,
      };
    });
    expect(
      doc.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_1")]
        ?.sourceEntityId.val,
    ).toBe("ste_1");
    expect(
      doc.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_1")]
        ?.targetEntityId.val,
    ).toBe("ste_2");
    expect(
      doc.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_1")]?.archived,
    ).toBe(false);
    expect(
      doc.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_1")]?.updatedAt,
    ).toBe(3000);
  });

  it("link entities survive Automerge binary round-trip", () => {
    doc = Automerge.change(doc, (d) => {
      d.structureEntityLinks[asSystemStructureEntityLinkId("stel_rt")] = {
        id: s("stel_rt"),
        systemId: s("sys_test"),
        entityId: s("ste_rt"),
        parentEntityId: null,
        sortOrder: 5,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_rt")] = {
        id: s("steml_rt"),
        systemId: s("sys_test"),
        parentEntityId: s("ste_rt"),
        memberId: s("mem_rt"),
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_rt")] = {
        id: s("stea_rt"),
        systemId: s("sys_test"),
        sourceEntityId: s("ste_1"),
        targetEntityId: s("ste_2"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<SystemCoreDocument>(bytes);
    expect(
      loaded.structureEntityLinks[asSystemStructureEntityLinkId("stel_rt")]?.entityId.val,
    ).toBe("ste_rt");
    expect(
      loaded.structureEntityMemberLinks[asSystemStructureEntityMemberLinkId("steml_rt")]?.memberId
        .val,
    ).toBe("mem_rt");
    expect(
      loaded.structureEntityAssociations[asSystemStructureEntityAssociationId("stea_rt")]
        ?.sourceEntityId.val,
    ).toBe("ste_1");
  });
});
