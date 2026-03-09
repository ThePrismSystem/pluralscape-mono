import { describe, expect, it } from "vitest";

import * as pgAudit from "../helpers/audit.pg.js";
import * as sqliteAudit from "../helpers/audit.sqlite.js";

describe("PG audit helpers", () => {
  it("timestamps() returns createdAt and updatedAt columns", () => {
    const cols = pgAudit.timestamps();
    expect(cols).toHaveProperty("createdAt");
    expect(cols).toHaveProperty("updatedAt");
  });

  it("archivable() returns archived and archivedAt columns", () => {
    const cols = pgAudit.archivable();
    expect(cols).toHaveProperty("archived");
    expect(cols).toHaveProperty("archivedAt");
  });

  it("versioned() returns version column", () => {
    const cols = pgAudit.versioned();
    expect(cols).toHaveProperty("version");
  });
});

describe("SQLite audit helpers", () => {
  it("timestamps() returns createdAt and updatedAt columns", () => {
    const cols = sqliteAudit.timestamps();
    expect(cols).toHaveProperty("createdAt");
    expect(cols).toHaveProperty("updatedAt");
  });

  it("archivable() returns archived and archivedAt columns", () => {
    const cols = sqliteAudit.archivable();
    expect(cols).toHaveProperty("archived");
    expect(cols).toHaveProperty("archivedAt");
  });

  it("versioned() returns version column", () => {
    const cols = sqliteAudit.versioned();
    expect(cols).toHaveProperty("version");
  });
});
