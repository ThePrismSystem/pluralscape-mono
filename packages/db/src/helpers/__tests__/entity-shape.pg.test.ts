import { getTableColumns } from "drizzle-orm";
import { getTableConfig, pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { archivable, timestamps, versioned } from "../audit.pg.js";
import { encryptedPayload, entityIdentity, serverEntityChecks } from "../entity-shape.pg.js";

import type { MemberId } from "@pluralscape/types";

describe("entityIdentity (pg)", () => {
  it("produces id (PK) and systemId (notNull FK) columns", () => {
    const t = pgTable("test_identity", { ...entityIdentity<MemberId>() });
    const cols = getTableColumns(t);
    expect(cols.id.primary).toBe(true);
    expect(cols.systemId.notNull).toBe(true);
  });
});

describe("encryptedPayload (pg)", () => {
  it("produces a notNull encryptedData bytea column", () => {
    const t = pgTable("test_payload", { ...encryptedPayload() });
    const cols = getTableColumns(t);
    expect(cols.encryptedData.notNull).toBe(true);
  });
});

describe("serverEntityChecks (pg)", () => {
  it("emits version and archivable consistency check constraints", () => {
    const t = pgTable(
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
