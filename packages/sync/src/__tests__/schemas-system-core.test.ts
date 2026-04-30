import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import { makeSystemCoreDoc, s } from "./helpers/schema-fixtures.js";
import {
  asFieldDefinitionId,
  asFieldValueId,
  asGroupMembershipKey,
  asLifecycleEventId,
  asMemberId,
} from "./test-crypto-helpers.js";

import type { SystemCoreDocument } from "../schemas/system-core.js";

// ── SystemCoreDocument: basic ops + field definitions/values + serialization ─

describe("SystemCoreDocument schema", () => {
  it("initializes with empty maps and lists", () => {
    const doc = makeSystemCoreDoc();
    expect(Object.keys(doc.members)).toHaveLength(0);
    expect(Object.keys(doc.groups)).toHaveLength(0);
    expect(Object.keys(doc.lifecycleEvents)).toHaveLength(0);
    expect(Object.keys(doc.groupMemberships)).toHaveLength(0);
  });

  it("reads singleton fields as ImmutableString", () => {
    const doc = makeSystemCoreDoc();
    expect(doc.system.name.val).toBe("Test System");
    expect(doc.system.displayName).toBeNull();
    expect(doc.systemSettings.theme.val).toBe("system");
  });

  it("adds and reads a member via map CRUD", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Luna"),
        pronouns: s('["she/her"]'),
        description: s("Host"),
        avatarSource: null,
        colors: s('["#8B5CF6"]'),
        saturationLevel: s('{"kind":"known","level":"highly-elaborated"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    expect(doc.members[asMemberId("mem_1")]?.name.val).toBe("Luna");
    expect(doc.members[asMemberId("mem_1")]?.description?.val).toBe("Host");
  });

  it("updates a member field with LWW semantics", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
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
    doc = Automerge.change(doc, (d) => {
      const member = d.members[asMemberId("mem_1")];
      if (member) {
        member.name = s("Updated");
        member.updatedAt = 2000;
      }
    });
    expect(doc.members[asMemberId("mem_1")]?.name.val).toBe("Updated");
  });

  it("adds lifecycle events to the append-lww map", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.lifecycleEvents[asLifecycleEventId("le_1")] = {
        id: s("le_1"),
        systemId: s("sys_test"),
        eventType: s("discovery"),
        occurredAt: 1000,
        recordedAt: 1001,
        notes: null,
        payload: s('{"memberId":"mem_1"}'),
        archived: false,
      };
    });
    doc = Automerge.change(doc, (d) => {
      d.lifecycleEvents[asLifecycleEventId("le_2")] = {
        id: s("le_2"),
        systemId: s("sys_test"),
        eventType: s("split"),
        occurredAt: 2000,
        recordedAt: 2001,
        notes: s("Split during stressful week"),
        payload: s('{"sourceMemberId":"mem_1","resultMemberIds":["mem_2","mem_3"]}'),
        archived: false,
      };
    });
    expect(Object.keys(doc.lifecycleEvents)).toHaveLength(2);
    expect(doc.lifecycleEvents[asLifecycleEventId("le_1")]?.eventType.val).toBe("discovery");
    expect(doc.lifecycleEvents[asLifecycleEventId("le_2")]?.eventType.val).toBe("split");
  });

  it("supports LWW mutation of archived field on lifecycle events", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.lifecycleEvents[asLifecycleEventId("le_1")] = {
        id: s("le_1"),
        systemId: s("sys_test"),
        eventType: s("discovery"),
        occurredAt: 1000,
        recordedAt: 1001,
        notes: null,
        payload: s('{"memberId":"mem_1"}'),
        archived: false,
      };
    });
    expect(doc.lifecycleEvents[asLifecycleEventId("le_1")]?.archived).toBe(false);
    doc = Automerge.change(doc, (d) => {
      const event = d.lifecycleEvents[asLifecycleEventId("le_1")];
      if (event) {
        event.archived = true;
      }
    });
    expect(doc.lifecycleEvents[asLifecycleEventId("le_1")]?.archived).toBe(true);
  });

  it("adds junction map entries with compound keys", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.groupMemberships[asGroupMembershipKey("g1:m1")] = true;
      d.groupMemberships[asGroupMembershipKey("g1:m2")] = true;
    });
    expect(doc.groupMemberships[asGroupMembershipKey("g1:m1")]).toBe(true);
    expect(doc.groupMemberships[asGroupMembershipKey("g1:m2")]).toBe(true);
    expect(Object.keys(doc.groupMemberships)).toHaveLength(2);
  });

  it("CrdtFieldDefinition includes scopes field", () => {
    let doc = makeSystemCoreDoc();
    const scopesJson = JSON.stringify([
      { scopeType: "member" },
      { scopeType: "all-structure-entity-types" },
    ]);
    doc = Automerge.change(doc, (d) => {
      d.fieldDefinitions[asFieldDefinitionId("fd_1")] = {
        id: s("fd_1"),
        systemId: s("sys_test"),
        name: s("Pronouns"),
        description: null,
        fieldType: s("text"),
        options: null,
        required: false,
        sortOrder: 0,
        scopes: s(scopesJson),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.fieldDefinitions[asFieldDefinitionId("fd_1")]?.scopes.val).toBe(scopesJson);
  });

  describe("CrdtFieldValue polymorphic owner", () => {
    it("supports structureEntityId owner", () => {
      let doc = makeSystemCoreDoc();
      doc = Automerge.change(doc, (d) => {
        d.fieldValues[asFieldValueId("fv_se")] = {
          id: s("fv_se"),
          fieldDefinitionId: s("fd_1"),
          memberId: null,
          structureEntityId: s("ste_1"),
          groupId: null,
          value: s('"some value"'),
          createdAt: 1000,
          updatedAt: 1000,
        };
      });
      expect(doc.fieldValues[asFieldValueId("fv_se")]?.structureEntityId?.val).toBe("ste_1");
      expect(doc.fieldValues[asFieldValueId("fv_se")]?.memberId).toBeNull();
      expect(doc.fieldValues[asFieldValueId("fv_se")]?.groupId).toBeNull();
    });

    it("supports memberId owner", () => {
      let doc = makeSystemCoreDoc();
      doc = Automerge.change(doc, (d) => {
        d.fieldValues[asFieldValueId("fv_mem")] = {
          id: s("fv_mem"),
          fieldDefinitionId: s("fd_1"),
          memberId: s("mem_1"),
          structureEntityId: null,
          groupId: null,
          value: s('"member value"'),
          createdAt: 1000,
          updatedAt: 1000,
        };
      });
      expect(doc.fieldValues[asFieldValueId("fv_mem")]?.memberId?.val).toBe("mem_1");
      expect(doc.fieldValues[asFieldValueId("fv_mem")]?.structureEntityId).toBeNull();
      expect(doc.fieldValues[asFieldValueId("fv_mem")]?.groupId).toBeNull();
    });

    it("supports groupId owner", () => {
      let doc = makeSystemCoreDoc();
      doc = Automerge.change(doc, (d) => {
        d.fieldValues[asFieldValueId("fv_grp")] = {
          id: s("fv_grp"),
          fieldDefinitionId: s("fd_1"),
          memberId: null,
          structureEntityId: null,
          groupId: s("grp_1"),
          value: s('"group value"'),
          createdAt: 1000,
          updatedAt: 1000,
        };
      });
      expect(doc.fieldValues[asFieldValueId("fv_grp")]?.groupId?.val).toBe("grp_1");
      expect(doc.fieldValues[asFieldValueId("fv_grp")]?.memberId).toBeNull();
      expect(doc.fieldValues[asFieldValueId("fv_grp")]?.structureEntityId).toBeNull();
    });
  });

  it("saves and loads via Automerge binary serialization", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members[asMemberId("mem_1")] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Kai"),
        pronouns: s('["they/them"]'),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"highly-elaborated"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<SystemCoreDocument>(bytes);
    expect(loaded.members[asMemberId("mem_1")]?.name.val).toBe("Kai");
    expect(loaded.system.name.val).toBe("Test System");
    expect(Object.keys(loaded.lifecycleEvents)).toHaveLength(0);
  });
});
