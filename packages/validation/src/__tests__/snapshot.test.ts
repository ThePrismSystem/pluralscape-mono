import { describe, expect, it } from "vitest";

import { SnapshotContentSchema } from "../snapshot.js";

const EMPTY_CONTENT = {
  name: null,
  description: null,
  members: [],
  structureEntityTypes: [],
  structureEntities: [],
  structureEntityLinks: [],
  structureEntityMemberLinks: [],
  structureEntityAssociations: [],
  relationships: [],
  groups: [],
  innerworldRegions: [],
  innerworldEntities: [],
};

describe("SnapshotContentSchema", () => {
  it("accepts a minimal empty SnapshotContent", () => {
    const result = SnapshotContentSchema.safeParse(EMPTY_CONTENT);
    expect(result.success).toBe(true);
  });

  it("accepts a populated SnapshotContent (one of each sub-array)", () => {
    const now = Date.now();
    const result = SnapshotContentSchema.safeParse({
      ...EMPTY_CONTENT,
      name: "Pre-merge snapshot",
      description: null,
      members: [
        {
          id: "mem_1",
          name: "Alex",
          pronouns: ["they/them"],
          description: "Test member",
          tags: [],
          saturationLevel: null,
          archived: false,
        },
      ],
      structureEntityTypes: [{ id: "set_1", name: "Headmate", description: null }],
      structureEntities: [
        {
          id: "se_1",
          entityTypeId: "set_1",
          name: "Outer Council",
          description: null,
        },
      ],
      structureEntityLinks: [
        {
          id: "sel_1",
          systemId: "sys_1",
          entityId: "se_1",
          parentEntityId: null,
          sortOrder: 0,
          createdAt: now,
        },
      ],
      structureEntityMemberLinks: [
        {
          id: "seml_1",
          systemId: "sys_1",
          parentEntityId: null,
          memberId: "mem_1",
          sortOrder: 0,
          createdAt: now,
        },
      ],
      structureEntityAssociations: [
        {
          id: "sea_1",
          systemId: "sys_1",
          sourceEntityId: "se_1",
          targetEntityId: "se_1",
          createdAt: now,
        },
      ],
      relationships: [
        {
          sourceMemberId: "mem_1",
          targetMemberId: "mem_1",
          type: "sibling",
          bidirectional: true,
          label: null,
        },
      ],
      groups: [
        {
          id: "grp_1",
          name: "Front team",
          description: null,
          parentGroupId: null,
          memberIds: ["mem_1"],
        },
      ],
      innerworldRegions: [
        {
          id: "iwr_1",
          name: "Library",
          description: null,
          parentRegionId: null,
        },
      ],
      innerworldEntities: [
        {
          id: "iwe_1",
          regionId: null,
          entityType: "landmark",
          name: "Fountain",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid relationship type", () => {
    const result = SnapshotContentSchema.safeParse({
      ...EMPTY_CONTENT,
      relationships: [
        {
          sourceMemberId: "mem_1",
          targetMemberId: "mem_2",
          type: "frenemies",
          bidirectional: false,
          label: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a SnapshotMember missing required `id`", () => {
    const result = SnapshotContentSchema.safeParse({
      ...EMPTY_CONTENT,
      members: [
        {
          name: "Anonymous",
          pronouns: [],
          description: null,
          tags: [],
          saturationLevel: null,
          archived: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid innerworld entity entityType", () => {
    const result = SnapshotContentSchema.safeParse({
      ...EMPTY_CONTENT,
      innerworldEntities: [
        {
          id: "iwe_1",
          regionId: null,
          entityType: "wormhole",
          name: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a top-level missing field", () => {
    const partial = { ...EMPTY_CONTENT };
    Reflect.deleteProperty(partial, "members");
    const result = SnapshotContentSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });
});
