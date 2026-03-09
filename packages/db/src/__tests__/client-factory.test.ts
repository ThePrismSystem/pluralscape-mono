import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "../client/factory.js";

describe("createDatabase", () => {
  it("returns a PG client when given pg config", async () => {
    const client = await createDatabase({ dialect: "pg", connectionString: "" });
    expect(client.dialect).toBe("pg");
    expect(client.db).toBeDefined();
  });

  it("returns a SQLite client when given sqlite config", async () => {
    const client = await createDatabase({ dialect: "sqlite", filename: ":memory:" });
    expect(client.dialect).toBe("sqlite");
    expect(client.db).toBeDefined();
  });
});

describe("createDatabaseFromEnv", () => {
  const originalDialect = process.env["DB_DIALECT"];
  const originalUrl = process.env["DATABASE_URL"];
  const originalPath = process.env["DATABASE_PATH"];

  afterEach(() => {
    if (originalDialect === undefined) {
      delete process.env["DB_DIALECT"];
    } else {
      process.env["DB_DIALECT"] = originalDialect;
    }
    if (originalUrl === undefined) {
      delete process.env["DATABASE_URL"];
    } else {
      process.env["DATABASE_URL"] = originalUrl;
    }
    if (originalPath === undefined) {
      delete process.env["DATABASE_PATH"];
    } else {
      process.env["DATABASE_PATH"] = originalPath;
    }
  });

  it("throws when DATABASE_URL is missing for pg dialect", async () => {
    process.env["DB_DIALECT"] = "pg";
    delete process.env["DATABASE_URL"];
    const { createDatabaseFromEnv } = await import("../client/factory.js");
    await expect(createDatabaseFromEnv()).rejects.toThrow("DATABASE_URL");
  });
});
