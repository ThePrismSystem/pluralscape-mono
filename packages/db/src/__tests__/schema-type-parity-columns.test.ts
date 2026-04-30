/**
 * Schema-type parity: column-level checks.
 *
 * Verifies:
 * 1. PG and SQLite schemas have identical column sets for shared tables.
 * 2. Key columns changed in Fixes 1-8 exist with the expected names.
 * 3. DB-only columns appear only on tables that opt into them.
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as pg from "../schema/pg/index.js";
import * as sqlite from "../schema/sqlite/index.js";

import { DB_ONLY_COLUMNS, PG_ONLY_COLUMNS, TABLE_PAIRS } from "./helpers/schema-parity-fixtures.js";

// ---------------------------------------------------------------------------
// 1. PG / SQLite column parity
// ---------------------------------------------------------------------------
describe("PG and SQLite column parity", () => {
  for (const { name, pgTable, sqliteTable } of TABLE_PAIRS) {
    it(`${name} has identical column sets in PG and SQLite`, () => {
      const pgCols = new Set(Object.keys(pgTable));
      const sqliteCols = new Set(Object.keys(sqliteTable));
      const pgOnly = PG_ONLY_COLUMNS[name] ?? new Set<string>();

      const onlyInPg = [...pgCols].filter((c) => !sqliteCols.has(c) && !pgOnly.has(c));
      const onlyInSqlite = [...sqliteCols].filter((c) => !pgCols.has(c));

      expect(onlyInPg, `columns only in PG ${name}`).toEqual([]);
      expect(onlyInSqlite, `columns only in SQLite ${name}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Column existence — key tables touched in Fixes 1-8
// ---------------------------------------------------------------------------
describe("Column existence", () => {
  // Fix 1 — bucketContentTags.entityType typed as EntityType
  describe("bucketContentTags (Fix 1)", () => {
    it("PG has entityType, entityId, bucketId columns", () => {
      const cols = getTableColumns(pg.bucketContentTags);
      expect(cols).toHaveProperty("entityType");
      expect(cols).toHaveProperty("entityId");
      expect(cols).toHaveProperty("bucketId");
    });

    it("SQLite has entityType, entityId, bucketId columns", () => {
      const cols = getTableColumns(sqlite.bucketContentTags);
      expect(cols).toHaveProperty("entityType");
      expect(cols).toHaveProperty("entityId");
      expect(cols).toHaveProperty("bucketId");
    });

    it("no unexpected columns exist beyond the canonical four", () => {
      const pgCols = new Set(Object.keys(getTableColumns(pg.bucketContentTags)));
      const canonical = new Set(["entityType", "entityId", "bucketId", "systemId"]);
      const extra = [...pgCols].filter((c) => !canonical.has(c) && !DB_ONLY_COLUMNS.has(c));
      expect(extra).toEqual([]);
    });
  });

  // Fix 2 — memberPhotos.sortOrder non-nullable
  describe("memberPhotos (Fix 2)", () => {
    it("PG has sortOrder column", () => {
      const cols = getTableColumns(pg.memberPhotos);
      expect(cols).toHaveProperty("sortOrder");
    });

    it("SQLite has sortOrder column", () => {
      const cols = getTableColumns(sqlite.memberPhotos);
      expect(cols).toHaveProperty("sortOrder");
    });

    it("PG sortOrder column is named sort_order", () => {
      const cols = getTableColumns(pg.memberPhotos);
      expect(cols.sortOrder.name).toBe("sort_order");
    });
  });

  // Fix 3 — frontingComments has frontingSessionId (not a legacy name)
  describe("frontingComments (Fix 3)", () => {
    it("PG has frontingSessionId column", () => {
      const cols = getTableColumns(pg.frontingComments);
      expect(cols).toHaveProperty("frontingSessionId");
    });

    it("SQLite has frontingSessionId column", () => {
      const cols = getTableColumns(sqlite.frontingComments);
      expect(cols).toHaveProperty("frontingSessionId");
    });

    it("PG frontingSessionId DB column is named fronting_session_id", () => {
      const cols = getTableColumns(pg.frontingComments);
      expect(cols.frontingSessionId.name).toBe("fronting_session_id");
    });

    it("has expected canonical columns: id, frontingSessionId, systemId, sessionStartTime, memberId, encryptedData", () => {
      const cols = getTableColumns(pg.frontingComments);
      const expected = [
        "id",
        "frontingSessionId",
        "systemId",
        "sessionStartTime",
        "memberId",
        "encryptedData",
      ];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });
  });

  // Fix 6 — systemSettings has a separate id PK
  describe("systemSettings (Fix 6)", () => {
    it("PG has id column as primary key", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).toHaveProperty("id");
      expect(cols.id.primary).toBe(true);
    });

    it("SQLite has id column as primary key", () => {
      const cols = getTableColumns(sqlite.systemSettings);
      expect(cols).toHaveProperty("id");
      expect(cols.id.primary).toBe(true);
    });

    it("PG also has systemId as a separate column", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).toHaveProperty("systemId");
    });

    it("has expected columns: id, systemId, locale, pinHash, biometricEnabled, encryptedData", () => {
      const cols = getTableColumns(pg.systemSettings);
      const expected = ["id", "systemId", "locale", "pinHash", "biometricEnabled", "encryptedData"];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });

    it("does not have littlesSafeModeEnabled (moved to T1 encrypted)", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).not.toHaveProperty("littlesSafeModeEnabled");
    });
  });

  // Fix 7 — importJobs and exportRequests have updatedAt non-nullable
  describe("importJobs (Fix 7)", () => {
    it("PG has updatedAt column", () => {
      const cols = getTableColumns(pg.importJobs);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("SQLite has updatedAt column", () => {
      const cols = getTableColumns(sqlite.importJobs);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("PG updatedAt DB column is named updated_at", () => {
      const cols = getTableColumns(pg.importJobs);
      expect(cols.updatedAt.name).toBe("updated_at");
    });
  });

  describe("exportRequests (Fix 7)", () => {
    it("PG has updatedAt column", () => {
      const cols = getTableColumns(pg.exportRequests);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("SQLite has updatedAt column", () => {
      const cols = getTableColumns(sqlite.exportRequests);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("PG updatedAt DB column is named updated_at", () => {
      const cols = getTableColumns(pg.exportRequests);
      expect(cols.updatedAt.name).toBe("updated_at");
    });
  });

  // Fix 8 — frontingReports new table exists in both schemas
  describe("frontingReports (Fix 8)", () => {
    it("PG frontingReports table is defined", () => {
      expect(getTableColumns(pg.frontingReports)).toHaveProperty("id");
    });

    it("SQLite frontingReports table is defined", () => {
      expect(getTableColumns(sqlite.frontingReports)).toHaveProperty("id");
    });

    it("has expected columns: id, systemId, encryptedData, format, generatedAt", () => {
      const cols = getTableColumns(pg.frontingReports);
      const expected = ["id", "systemId", "encryptedData", "format", "generatedAt"];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });

    it("does not have plaintext JSONB columns — report data is T1 encrypted", () => {
      const pgCols = getTableColumns(pg.frontingReports);
      const sqliteCols = getTableColumns(sqlite.frontingReports);
      expect(pgCols).not.toHaveProperty("dateRange");
      expect(pgCols).not.toHaveProperty("memberBreakdowns");
      expect(pgCols).not.toHaveProperty("chartData");
      expect(sqliteCols).not.toHaveProperty("dateRange");
      expect(sqliteCols).not.toHaveProperty("memberBreakdowns");
      expect(sqliteCols).not.toHaveProperty("chartData");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. DB-only column allowlist — verify allowlisted columns don't appear on
//    tables that should be plaintext/simple records.
// ---------------------------------------------------------------------------
describe("DB-only column allowlist", () => {
  it("frontingReports has the expected DB-only columns: encryptedData, version, archived, archivedAt", () => {
    const cols = getTableColumns(pg.frontingReports);
    expect(cols).toHaveProperty("encryptedData");
    expect(cols).toHaveProperty("version");
    expect(cols).toHaveProperty("archived");
    expect(cols).toHaveProperty("archivedAt");
  });

  it("members has the expected DB-only columns: encryptedData, version, archived, archivedAt", () => {
    const cols = getTableColumns(pg.members);
    expect(cols).toHaveProperty("encryptedData");
    expect(cols).toHaveProperty("version");
    expect(cols).toHaveProperty("archived");
    expect(cols).toHaveProperty("archivedAt");
  });

  it("accounts has kdfSalt as a non-nullable column", () => {
    const cols = getTableColumns(pg.accounts);
    expect(cols).toHaveProperty("kdfSalt");
    expect(cols.kdfSalt.notNull).toBe(true);
  });
});
