import { afterEach, describe, expect, it } from "vitest";

import { getDialectCapabilities, isPostgreSQL, isSQLite } from "../dialect.js";

import type { DialectCapabilities } from "../dialect.js";

describe("dialect helpers", () => {
  const originalDialect = process.env["DB_DIALECT"];

  afterEach(() => {
    if (originalDialect === undefined) {
      delete process.env["DB_DIALECT"];
    } else {
      process.env["DB_DIALECT"] = originalDialect;
    }
  });

  describe("isPostgreSQL", () => {
    it("returns true when dialect is pg", () => {
      process.env["DB_DIALECT"] = "pg";

      expect(isPostgreSQL()).toBe(true);
    });

    it("returns false when dialect is sqlite", () => {
      process.env["DB_DIALECT"] = "sqlite";

      expect(isPostgreSQL()).toBe(false);
    });
  });

  describe("isSQLite", () => {
    it("returns true when dialect is sqlite", () => {
      process.env["DB_DIALECT"] = "sqlite";

      expect(isSQLite()).toBe(true);
    });

    it("returns false when dialect is pg", () => {
      process.env["DB_DIALECT"] = "pg";

      expect(isSQLite()).toBe(false);
    });
  });

  describe("getDialectCapabilities", () => {
    it("returns PG capabilities", () => {
      const caps: DialectCapabilities = getDialectCapabilities("pg");

      expect(caps.rls).toBe(true);
      expect(caps.jsonb).toBe(true);
      expect(caps.arrays).toBe(true);
      expect(caps.pgcrypto).toBe(true);
      expect(caps.nativeEnums).toBe(true);
      expect(caps.fullTextSearch).toBe(true);
    });

    it("returns SQLite capabilities", () => {
      const caps: DialectCapabilities = getDialectCapabilities("sqlite");

      expect(caps.rls).toBe(false);
      expect(caps.jsonb).toBe(false);
      expect(caps.arrays).toBe(false);
      expect(caps.pgcrypto).toBe(false);
      expect(caps.nativeEnums).toBe(false);
      expect(caps.fullTextSearch).toBe(false);
    });

    it("PG and SQLite capabilities are disjoint for rls", () => {
      const pg: DialectCapabilities = getDialectCapabilities("pg");
      const sqlite: DialectCapabilities = getDialectCapabilities("sqlite");

      expect(pg.rls).toBe(true);
      expect(sqlite.rls).toBe(false);
    });
  });
});
