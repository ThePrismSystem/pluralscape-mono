import { describe, expect, test } from "vitest";

import { ENTITY_CRDT_STRATEGIES } from "../../strategies/crdt-strategies.js";
import { ALL_CACHE_TABLES, getTableMetadataForEntityType } from "../drizzle-bridge.js";

import type { SyncedEntityType } from "../../strategies/crdt-strategies.js";

describe("getTableMetadataForEntityType", () => {
  test("returns metadata for member entity type", () => {
    const meta = getTableMetadataForEntityType("member");
    expect(meta.tableName).toBe("members");
    expect(meta.columnNames).toContain("name");
    expect(meta.columnNames).toContain("system_id");
    expect(meta.columnNames).toContain("id");
  });

  test("returns metadata for system-settings (singleton)", () => {
    const meta = getTableMetadataForEntityType("system-settings");
    expect(meta.tableName).toBe("system_settings");
    expect(meta.columnNames).toContain("theme");
  });

  test("returns metadata for renamed structure-entity-type table", () => {
    const meta = getTableMetadataForEntityType("structure-entity-type");
    expect(meta.tableName).toBe("structure_entity_types");
  });

  test("returns metadata for renamed timer table", () => {
    const meta = getTableMetadataForEntityType("timer");
    expect(meta.tableName).toBe("timers");
  });

  test("every SyncedEntityType has a cache table registered", () => {
    const allEntityTypes = Object.keys(ENTITY_CRDT_STRATEGIES) as SyncedEntityType[];
    for (const et of allEntityTypes) {
      const meta = getTableMetadataForEntityType(et);
      expect(meta.tableName).toBeTypeOf("string");
      expect(meta.columnNames.length).toBeGreaterThan(0);
    }
  });

  test("ALL_CACHE_TABLES enumerates every registered table", () => {
    const allEntityTypes = Object.keys(ENTITY_CRDT_STRATEGIES);
    expect(ALL_CACHE_TABLES.length).toBe(allEntityTypes.length);
  });
});
