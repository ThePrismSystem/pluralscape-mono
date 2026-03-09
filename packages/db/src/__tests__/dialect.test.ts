import { afterEach, describe, expect, it } from "vitest";

import { getDialect } from "../dialect.js";

describe("getDialect", () => {
  const originalDialect = process.env["DB_DIALECT"];

  afterEach(() => {
    if (originalDialect === undefined) {
      delete process.env["DB_DIALECT"];
    } else {
      process.env["DB_DIALECT"] = originalDialect;
    }
  });

  it("returns 'pg' when DB_DIALECT is 'pg'", () => {
    process.env["DB_DIALECT"] = "pg";
    expect(getDialect()).toBe("pg");
  });

  it("returns 'sqlite' when DB_DIALECT is 'sqlite'", () => {
    process.env["DB_DIALECT"] = "sqlite";
    expect(getDialect()).toBe("sqlite");
  });

  it("throws when DB_DIALECT is missing", () => {
    delete process.env["DB_DIALECT"];
    expect(() => getDialect()).toThrow("DB_DIALECT environment variable is required");
  });

  it("throws when DB_DIALECT is empty", () => {
    process.env["DB_DIALECT"] = "";
    expect(() => getDialect()).toThrow("DB_DIALECT environment variable is required");
  });

  it("throws when DB_DIALECT is invalid", () => {
    process.env["DB_DIALECT"] = "mysql";
    expect(() => getDialect()).toThrow("Invalid DB_DIALECT 'mysql'");
  });
});
