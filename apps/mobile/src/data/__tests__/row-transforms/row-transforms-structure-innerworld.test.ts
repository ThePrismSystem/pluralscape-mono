/**
 * Row transform tests for structure entities, innerworld entities, and innerworld regions.
 *
 * Covers: rowToStructureEntity, rowToStructureEntityType, rowToStructureEntityLink,
 *         rowToStructureEntityMemberLink, rowToStructureEntityAssociation,
 *         rowToInnerWorldEntity, rowToInnerWorldRegion
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-member-fronting.test.ts,
 *                  row-transforms-comms.test.ts,
 *                  row-transforms-misc.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  rowToInnerWorldEntity,
  rowToInnerWorldRegion,
  rowToStructureEntity,
  rowToStructureEntityAssociation,
  rowToStructureEntityLink,
  rowToStructureEntityMemberLink,
  rowToStructureEntityType,
} from "../row-transforms/index.js";

// ── rowToStructureEntity ──────────────────────────────────────────────────────

describe("rowToStructureEntity", () => {
  function baseStructureEntityRow(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: "se-arch",
      system_id: "sys-1",
      entity_type_id: "set-1",
      name: "Lattice",
      description: "Inner network",
      color: "#7777ff",
      image_source: null,
      emoji: "🔮",
      sort_order: 2.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps structure entity row", () => {
    const row: Record<string, unknown> = {
      id: "se-1",
      system_id: "sys-1",
      entity_type_id: "set-1",
      name: "Root",
      description: null,
      color: null,
      image_source: null,
      emoji: null,
      sort_order: 0.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToStructureEntity(row);

    expect(result.id).toBe("se-1");
    expect(result.entityTypeId).toBe("set-1");
    expect(result.name).toBe("Root");
    expect(result.description).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("returns archived structure entity when archived = 1", () => {
    const result = rowToStructureEntity(
      baseStructureEntityRow({ archived: 1, updated_at: 1_700_000_222_000 }),
    );
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_222_000);
    }
  });

  it("populates description, color, and emoji when present", () => {
    const result = rowToStructureEntity(baseStructureEntityRow());
    expect(result.description).toBe("Inner network");
    expect(result.color).toBe("#7777ff");
    expect(result.emoji).toBe("🔮");
  });
});

// ── rowToStructureEntityType ──────────────────────────────────────────────────

describe("rowToStructureEntityType", () => {
  it("maps structure entity type row", () => {
    const row: Record<string, unknown> = {
      id: "set-1",
      system_id: "sys-1",
      name: "Body",
      description: "Physical form",
      color: "#00ff00",
      image_source: null,
      emoji: "🧬",
      sort_order: 1.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToStructureEntityType(row);

    expect(result.id).toBe("set-1");
    expect(result.name).toBe("Body");
    expect(result.emoji).toBe("🧬");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("returns archived structure entity type when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "set-arch",
      system_id: "sys-1",
      name: "Old Type",
      description: null,
      color: null,
      image_source: null,
      emoji: null,
      sort_order: 1.0,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_333_000,
    };
    const result = rowToStructureEntityType(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_333_000);
    }
  });
});

// ── rowToStructureEntityLink ──────────────────────────────────────────────────

describe("rowToStructureEntityLink", () => {
  it("maps a structure entity link row", () => {
    const row: Record<string, unknown> = {
      id: "sel-1",
      system_id: "sys-1",
      entity_id: "se-1",
      parent_entity_id: "se-parent",
      sort_order: 0,
      created_at: 1_700_000_000_000,
    };
    const result = rowToStructureEntityLink(row);
    expect(result.id).toBe("sel-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.entityId).toBe("se-1");
    expect(result.parentEntityId).toBe("se-parent");
    expect(result.sortOrder).toBe(0);
    expect(result.createdAt).toBe(1_700_000_000_000);
  });

  it("supports null parentEntityId", () => {
    const row: Record<string, unknown> = {
      id: "sel-2",
      system_id: "sys-1",
      entity_id: "se-1",
      parent_entity_id: null,
      sort_order: 1,
      created_at: 1_700_000_000_000,
    };
    const result = rowToStructureEntityLink(row);
    expect(result.parentEntityId).toBeNull();
  });
});

// ── rowToStructureEntityMemberLink ────────────────────────────────────────────

describe("rowToStructureEntityMemberLink", () => {
  it("maps a structure entity member link row", () => {
    const row: Record<string, unknown> = {
      id: "seml-1",
      system_id: "sys-1",
      member_id: "mem-1",
      parent_entity_id: "se-1",
      sort_order: 0,
      created_at: 1_700_000_000_000,
    };
    const result = rowToStructureEntityMemberLink(row);
    expect(result.id).toBe("seml-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.parentEntityId).toBe("se-1");
    expect(result.sortOrder).toBe(0);
  });

  it("supports null parentEntityId", () => {
    const row: Record<string, unknown> = {
      id: "seml-2",
      system_id: "sys-1",
      member_id: "mem-1",
      parent_entity_id: null,
      sort_order: 0,
      created_at: 1_700_000_000_000,
    };
    const result = rowToStructureEntityMemberLink(row);
    expect(result.parentEntityId).toBeNull();
  });
});

// ── rowToStructureEntityAssociation ──────────────────────────────────────────

describe("rowToStructureEntityAssociation", () => {
  it("maps a structure entity association row", () => {
    const row: Record<string, unknown> = {
      id: "sea-1",
      system_id: "sys-1",
      source_entity_id: "se-1",
      target_entity_id: "se-2",
      created_at: 1_700_000_000_000,
    };
    const result = rowToStructureEntityAssociation(row);
    expect(result.id).toBe("sea-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.sourceEntityId).toBe("se-1");
    expect(result.targetEntityId).toBe("se-2");
    expect(result.createdAt).toBe(1_700_000_000_000);
  });
});

// ── rowToInnerWorldEntity ─────────────────────────────────────────────────────

describe("rowToInnerWorldEntity", () => {
  it("maps innerworld member entity row with JSON visual", () => {
    const row: Record<string, unknown> = {
      id: "iwe-1",
      system_id: "sys-1",
      entity_type: "member",
      position_x: 100.5,
      position_y: 200.0,
      visual:
        '{"color":"#ff0000","icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      region_id: "iwr-1",
      linked_member_id: "mem-1",
      linked_structure_entity_id: null,
      name: null,
      description: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldEntity(row);

    expect(result.id).toBe("iwe-1");
    expect(result.entityType).toBe("member");
    expect(result.positionX).toBe(100.5);
    expect(result.positionY).toBe(200.0);
    expect(result.regionId).toBe("iwr-1");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
    if (result.entityType === "member") {
      expect(result.linkedMemberId).toBe("mem-1");
    }
  });
});

describe("rowToInnerWorldEntity entity-type branches", () => {
  function baseEntityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "iwe-x",
      system_id: "sys-1",
      entity_type: "member",
      position_x: 0,
      position_y: 0,
      visual:
        '{"color":null,"icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      region_id: null,
      linked_member_id: "mem-1",
      linked_structure_entity_id: null,
      name: null,
      description: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps a landmark entity with name and description", () => {
    const row = baseEntityRow({
      entity_type: "landmark",
      linked_member_id: null,
      name: "Old Oak",
      description: "Ancient tree at the center",
    });
    const result = rowToInnerWorldEntity(row);
    expect(result.entityType).toBe("landmark");
    if (result.entityType === "landmark") {
      expect(result.name).toBe("Old Oak");
      expect(result.description).toBe("Ancient tree at the center");
    }
  });

  it("falls back to empty name when landmark name is null", () => {
    const row = baseEntityRow({
      entity_type: "landmark",
      linked_member_id: null,
      name: null,
    });
    const result = rowToInnerWorldEntity(row);
    expect(result.entityType).toBe("landmark");
    if (result.entityType === "landmark") {
      expect(result.name).toBe("");
    }
  });

  it("returns archived landmark when archived = 1", () => {
    const row = baseEntityRow({
      entity_type: "landmark",
      linked_member_id: null,
      name: "Old Oak",
      archived: 1,
      updated_at: 1_700_000_999_000,
    });
    const result = rowToInnerWorldEntity(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_999_000);
    }
  });

  it("maps a structure-entity link", () => {
    const row = baseEntityRow({
      entity_type: "structure-entity",
      linked_member_id: null,
      linked_structure_entity_id: "se-42",
    });
    const result = rowToInnerWorldEntity(row);
    expect(result.entityType).toBe("structure-entity");
    if (result.entityType === "structure-entity") {
      expect(result.linkedStructureEntityId).toBe("se-42");
    }
  });

  it("returns archived structure-entity when archived = 1", () => {
    const row = baseEntityRow({
      entity_type: "structure-entity",
      linked_member_id: null,
      linked_structure_entity_id: "se-42",
      archived: 1,
      updated_at: 1_700_000_777_000,
    });
    const result = rowToInnerWorldEntity(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_777_000);
    }
  });

  it("returns archived member entity when archived = 1", () => {
    const row = baseEntityRow({ archived: 1, updated_at: 1_700_000_555_000 });
    const result = rowToInnerWorldEntity(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_555_000);
    }
  });
});

// ── rowToInnerWorldRegion ─────────────────────────────────────────────────────

describe("rowToInnerWorldRegion", () => {
  it("maps innerworld region row with JSON fields", () => {
    const row: Record<string, unknown> = {
      id: "iwr-1",
      system_id: "sys-1",
      name: "Forest",
      description: "A peaceful place",
      parent_region_id: null,
      visual:
        '{"color":null,"icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      boundary_data: '[{"x":0,"y":0},{"x":100,"y":0}]',
      access_type: "open",
      gatekeeper_member_ids: "[]",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldRegion(row);

    expect(result.id).toBe("iwr-1");
    expect(result.name).toBe("Forest");
    expect(result.parentRegionId).toBeNull();
    expect(result.boundaryData).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.accessType).toBe("open");
    expect(result.gatekeeperMemberIds).toEqual([]);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

describe("rowToInnerWorldRegion archived branch", () => {
  it("returns archived region when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "iwr-arch",
      system_id: "sys-1",
      name: "Old Forest",
      description: null,
      parent_region_id: null,
      visual:
        '{"color":null,"icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      boundary_data: "[]",
      access_type: "open",
      gatekeeper_member_ids: "[]",
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_111_000,
    };
    const result = rowToInnerWorldRegion(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_111_000);
    }
  });
});
