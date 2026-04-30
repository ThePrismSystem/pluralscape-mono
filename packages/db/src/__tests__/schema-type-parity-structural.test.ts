/**
 * Schema-type parity: structural (index / FK / CHECK) parity between
 * PG and SQLite tables.
 */

import { describe, expect, it } from "vitest";

import {
  KNOWN_FK_DIVERGENCES,
  KNOWN_PG_ONLY_INDEXES,
  KNOWN_SQLITE_ONLY_INDEXES,
  STRUCTURAL_PAIRS,
} from "./helpers/schema-parity-fixtures.js";

// ---------------------------------------------------------------------------
// 7. Index name parity
// ---------------------------------------------------------------------------
describe("PG and SQLite index name parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching index names`, () => {
      const pgSet = new Set(pair.pgIndexNames);
      const sqlSet = new Set(pair.sqliteIndexNames);

      const pgOnly = pair.pgIndexNames.filter(
        (n) => !sqlSet.has(n) && !KNOWN_PG_ONLY_INDEXES.has(n),
      );
      const sqliteOnly = pair.sqliteIndexNames.filter(
        (n) => !pgSet.has(n) && !KNOWN_SQLITE_ONLY_INDEXES.has(n),
      );

      expect(pgOnly, `${pair.name} indexes only in PG`).toEqual([]);
      expect(sqliteOnly, `${pair.name} indexes only in SQLite`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Foreign-key count parity
// ---------------------------------------------------------------------------
describe("PG and SQLite FK count parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching FK count`, () => {
      const known = KNOWN_FK_DIVERGENCES[pair.name];
      if (known) {
        expect(pair.pgFkCount, `PG FK count for ${pair.name}`).toBe(known[0]);
        expect(pair.sqliteFkCount, `SQLite FK count for ${pair.name}`).toBe(known[1]);
      } else {
        expect(pair.pgFkCount, `FK count mismatch in ${pair.name}`).toBe(pair.sqliteFkCount);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 9. CHECK constraint count parity
// ---------------------------------------------------------------------------
describe("PG and SQLite CHECK constraint count parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching CHECK constraint count`, () => {
      expect(pair.pgCheckCount, `CHECK count mismatch in ${pair.name}`).toBe(pair.sqliteCheckCount);
    });
  }
});
