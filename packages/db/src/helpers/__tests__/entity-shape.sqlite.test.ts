import { getTableColumns } from "drizzle-orm";
import { getTableConfig, sqliteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { archivable, timestamps, versioned } from "../audit.sqlite.js";
import {
  commonEntityIndexes,
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../entity-shape.sqlite.js";

import type { MemberId } from "@pluralscape/types";

describe("entityIdentity (sqlite)", () => {
  it("produces id (PK) and systemId (notNull FK) columns", () => {
    const t = sqliteTable("test_identity", { ...entityIdentity<MemberId>() });
    const cols = getTableColumns(t);
    expect(cols.id).toBeDefined();
    expect(cols.id.primary).toBe(true);
    expect(cols.systemId).toBeDefined();
    expect(cols.systemId.notNull).toBe(true);
  });
});

describe("encryptedPayload (sqlite)", () => {
  it("produces a notNull encryptedData blob column", () => {
    const t = sqliteTable("test_payload", { ...encryptedPayload() });
    const cols = getTableColumns(t);
    expect(cols.encryptedData).toBeDefined();
    expect(cols.encryptedData.notNull).toBe(true);
  });
});

describe("commonEntityIndexes (sqlite)", () => {
  it("emits the three standard index/unique entries with derived names", () => {
    const t = sqliteTable(
      "test_table",
      { ...entityIdentity<MemberId>(), ...timestamps(), ...archivable() },
      (cols) => commonEntityIndexes("test_table", cols),
    );
    const config = getTableConfig(t);
    const indexNames = config.indexes.map((i) => i.config.name);
    const uniqueNames = config.uniqueConstraints.map((u) => u.name);

    expect(indexNames).toContain("test_table_system_id_archived_idx");
    expect(indexNames).toContain("test_table_created_at_idx");
    expect(uniqueNames).toContain("test_table_id_system_id_unique");
  });
});

describe("serverEntityChecks (sqlite)", () => {
  it("emits version and archivable consistency check constraints", () => {
    const t = sqliteTable(
      "test_table",
      {
        ...entityIdentity<MemberId>(),
        ...encryptedPayload(),
        ...timestamps(),
        ...versioned(),
        ...archivable(),
      },
      (cols) => serverEntityChecks("test_table", cols),
    );
    const config = getTableConfig(t);
    const checkNames = config.checks.map((c) => c.name);

    expect(checkNames).toContain("test_table_version_check");
    expect(checkNames).toContain("test_table_archived_consistency_check");
  });
});
