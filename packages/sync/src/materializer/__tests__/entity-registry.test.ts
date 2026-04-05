import { describe, expect, it } from "vitest";

import { ENTITY_CRDT_STRATEGIES } from "../../strategies/crdt-strategies.js";
import {
  ENTITY_TABLE_REGISTRY,
  getEntityTypesForDocument,
  getTableDef,
} from "../entity-registry.js";
import "../index.js"; // trigger auto-registration
import { getMaterializer } from "../materializer-registry.js";

const ALL_DOC_TYPES = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "note",
  "privacy-config",
  "bucket",
] as const;

const ALL_ENTITY_TYPES = Object.keys(ENTITY_CRDT_STRATEGIES);

describe("ENTITY_TABLE_REGISTRY", () => {
  it("has an entry for every synced entity type", () => {
    for (const entityType of ALL_ENTITY_TYPES) {
      expect(
        Object.keys(ENTITY_TABLE_REGISTRY),
        `Missing registry entry for: ${entityType}`,
      ).toContain(entityType);
    }
  });

  it("every entry has a non-empty table name", () => {
    for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY)) {
      expect(def.tableName.length, `Empty tableName for ${entityType}`).toBeGreaterThan(0);
    }
  });

  it("every entry has an id column", () => {
    for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY)) {
      const hasId = def.columns.some((col) => col.name === "id");
      expect(hasId, `Missing id column for ${entityType}`).toBe(true);
    }
  });

  it("fts columns reference existing column names", () => {
    for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY)) {
      const colNames = new Set(def.columns.map((c) => c.name));
      for (const ftsCol of def.ftsColumns) {
        expect(colNames, `FTS column '${ftsCol}' not in columns for ${entityType}`).toContain(
          ftsCol,
        );
      }
    }
  });

  it("getTableDef returns the correct definition for 'member'", () => {
    const def = getTableDef("member");
    expect(def.tableName).toBe("members");
    expect(def.hotPath).toBe(false);
    expect(def.columns.some((c) => c.name === "id")).toBe(true);
    expect(def.columns.some((c) => c.name === "system_id")).toBe(true);
    expect(def.columns.some((c) => c.name === "name")).toBe(true);
    expect(def.columns.some((c) => c.name === "archived")).toBe(true);
  });

  it("hot path entities are flagged correctly", () => {
    // fronting entities — all hot path
    expect(ENTITY_TABLE_REGISTRY["fronting-session"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["fronting-comment"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["check-in-record"].hotPath).toBe(true);

    // chat entities — all hot path
    expect(ENTITY_TABLE_REGISTRY["message"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["channel"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["board-message"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["poll"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["poll-option"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["poll-vote"].hotPath).toBe(true);
    expect(ENTITY_TABLE_REGISTRY["acknowledgement"].hotPath).toBe(true);

    // system-core entity — not hot path
    expect(ENTITY_TABLE_REGISTRY["member"].hotPath).toBe(false);

    // journal entities — not hot path
    expect(ENTITY_TABLE_REGISTRY["journal-entry"].hotPath).toBe(false);
    expect(ENTITY_TABLE_REGISTRY["wiki-page"].hotPath).toBe(false);
    expect(ENTITY_TABLE_REGISTRY["note"].hotPath).toBe(false);

    // privacy-config entities — not hot path
    expect(ENTITY_TABLE_REGISTRY["bucket"].hotPath).toBe(false);
    expect(ENTITY_TABLE_REGISTRY["friend-connection"].hotPath).toBe(false);
  });

  it("id column is a primary key TEXT column", () => {
    for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY)) {
      const idCol = def.columns.find((c) => c.name === "id");
      expect(idCol, `No id column for ${entityType}`).toBeDefined();
      expect(idCol?.sqlType, `id not TEXT for ${entityType}`).toBe("TEXT");
      expect(idCol?.primaryKey, `id not primaryKey for ${entityType}`).toBe(true);
    }
  });
});

describe("getEntityTypesForDocument", () => {
  it("returns all system-core entity types", () => {
    const types = getEntityTypesForDocument("system-core");
    expect(types).toContain("member");
    expect(types).toContain("group");
    expect(types).toContain("system");
    expect(types).toContain("system-settings");
    expect(types).toContain("group-membership");
    expect(types).not.toContain("fronting-session");
    expect(types).not.toContain("message");
  });

  it("returns all fronting entity types", () => {
    const types = getEntityTypesForDocument("fronting");
    expect(types).toContain("fronting-session");
    expect(types).toContain("fronting-comment");
    expect(types).toContain("check-in-record");
    expect(types).not.toContain("member");
  });

  it("returns all chat entity types", () => {
    const types = getEntityTypesForDocument("chat");
    expect(types).toContain("channel");
    expect(types).toContain("message");
    expect(types).toContain("board-message");
    expect(types).toContain("poll");
    expect(types).toContain("poll-option");
    expect(types).toContain("poll-vote");
    expect(types).toContain("acknowledgement");
    expect(types).not.toContain("fronting-session");
  });

  it("returns all journal entity types", () => {
    const types = getEntityTypesForDocument("journal");
    expect(types).toContain("journal-entry");
    expect(types).toContain("wiki-page");
    expect(types).toContain("note");
    expect(types).not.toContain("fronting-session");
  });

  it("returns all privacy-config entity types", () => {
    const types = getEntityTypesForDocument("privacy-config");
    expect(types).toContain("bucket");
    expect(types).toContain("bucket-content-tag");
    expect(types).toContain("friend-connection");
    expect(types).toContain("friend-code");
    expect(types).toContain("key-grant");
    expect(types).toContain("field-bucket-visibility");
    expect(types).not.toContain("member");
  });

  it("returns empty array for unknown document type", () => {
    const types = getEntityTypesForDocument("unknown-document");
    expect(types).toEqual([]);
  });
});

describe("materializer registration", () => {
  it.each(ALL_DOC_TYPES)("registers a materializer for %s", (docType) => {
    expect(getMaterializer(docType)).toBeDefined();
  });
});
