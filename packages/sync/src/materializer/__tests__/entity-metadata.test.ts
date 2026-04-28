import { describe, expect, it } from "vitest";

import { ENTITY_CRDT_STRATEGIES } from "../../strategies/crdt-strategies.js";
import { getTableMetadataForEntityType } from "../drizzle-bridge.js";
import { ENTITY_METADATA, FRIEND_EXPORTABLE_ENTITY_TYPES } from "../entity-metadata.js";
import "../index.js"; // trigger auto-registration
import { generateAllDdl } from "../local-schema.js";
import { getMaterializer } from "../materializer-registry.js";

import type { SyncedEntityType } from "../../strategies/crdt-strategies.js";

const ALL_DOC_TYPES = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "note",
  "privacy-config",
  "bucket",
] as const;

const ALL_ENTITY_TYPES = Object.keys(ENTITY_CRDT_STRATEGIES) as readonly SyncedEntityType[];

describe("ENTITY_METADATA", () => {
  it("has an entry for every synced entity type", () => {
    for (const entityType of ALL_ENTITY_TYPES) {
      expect(Object.keys(ENTITY_METADATA), `Missing metadata entry for: ${entityType}`).toContain(
        entityType,
      );
    }
  });

  it("FTS columns reference real cache columns", () => {
    for (const entityType of ALL_ENTITY_TYPES) {
      const meta = ENTITY_METADATA[entityType];
      const tableMeta = getTableMetadataForEntityType(entityType);
      const colNames = new Set(tableMeta.columnNames);
      for (const ftsCol of meta.ftsColumns) {
        expect(
          colNames,
          `FTS column '${ftsCol}' missing from cache columns for ${entityType}`,
        ).toContain(ftsCol);
      }
    }
  });

  it("hot path entities are flagged correctly", () => {
    expect(ENTITY_METADATA["fronting-session"].hotPath).toBe(true);
    expect(ENTITY_METADATA["fronting-comment"].hotPath).toBe(true);
    expect(ENTITY_METADATA["check-in-record"].hotPath).toBe(true);

    expect(ENTITY_METADATA["message"].hotPath).toBe(true);
    expect(ENTITY_METADATA["channel"].hotPath).toBe(true);
    expect(ENTITY_METADATA["board-message"].hotPath).toBe(true);
    expect(ENTITY_METADATA["poll"].hotPath).toBe(true);
    expect(ENTITY_METADATA["poll-option"].hotPath).toBe(true);
    expect(ENTITY_METADATA["poll-vote"].hotPath).toBe(true);
    expect(ENTITY_METADATA["acknowledgement"].hotPath).toBe(true);

    expect(ENTITY_METADATA["member"].hotPath).toBe(false);
    expect(ENTITY_METADATA["journal-entry"].hotPath).toBe(false);
    expect(ENTITY_METADATA["bucket"].hotPath).toBe(false);
    expect(ENTITY_METADATA["friend-connection"].hotPath).toBe(false);
  });

  it("messages have compoundDetailKey for invalidator routing", () => {
    expect(ENTITY_METADATA["message"].compoundDetailKey).toBe(true);
  });
});

describe("FRIEND_EXPORTABLE_ENTITY_TYPES", () => {
  it("only contains valid SyncedEntityType keys", () => {
    for (const entityType of FRIEND_EXPORTABLE_ENTITY_TYPES) {
      expect(ALL_ENTITY_TYPES).toContain(entityType);
    }
  });
});

describe("materializer registration", () => {
  it.each(ALL_DOC_TYPES)("registers a materializer for %s", (docType) => {
    expect(getMaterializer(docType)?.documentType).toBe(docType);
  });
});

describe("generateAllDdl", () => {
  it("produces DDL covering every document type", () => {
    const ddl = generateAllDdl();
    expect(ddl.length).toBeGreaterThan(0);
    const joined = ddl.join(" ");
    expect(joined).toContain("members");
    expect(joined).toContain("fronting_sessions");
    expect(joined).toContain("channels");
    expect(joined).toContain("journal_entries");
    expect(joined).toContain("notes");
    expect(joined).toContain("buckets");
    expect(joined).toContain("friend_connections");
  });
});
