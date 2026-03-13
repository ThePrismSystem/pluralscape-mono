import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabase, createDatabaseFromEnv } from "../client/factory.js";

// better-sqlite3 requires native bindings that may not be available in all
// environments (e.g., CI without build tools). Mock the dynamic imports so
// factory logic is tested without requiring the native module.
function MockDatabase(): void {
  // @ts-expect-error -- mock constructor assigning pragma
  this.pragma = vi.fn();
}
const mockDrizzle = vi.fn(() => ({ mock: true }));

vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
}));

vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: mockDrizzle,
}));

describe("createDatabase", () => {
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
    vi.restoreAllMocks();
  });

  it("throws when DATABASE_URL is missing for pg dialect", async () => {
    process.env["DB_DIALECT"] = "pg";
    delete process.env["DATABASE_URL"];
    await expect(createDatabaseFromEnv()).rejects.toThrow("DATABASE_URL");
  });

  it("creates SQLite client with explicit DATABASE_PATH", async () => {
    process.env["DB_DIALECT"] = "sqlite";
    process.env["DATABASE_PATH"] = ":memory:";
    const client = await createDatabaseFromEnv();
    expect(client.dialect).toBe("sqlite");
    expect(client.db).toBeDefined();
  });

  it("warns and defaults when DATABASE_PATH is not set", async () => {
    process.env["DB_DIALECT"] = "sqlite";
    delete process.env["DATABASE_PATH"];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = await createDatabaseFromEnv();
    expect(client.dialect).toBe("sqlite");
    expect(warnSpy).toHaveBeenCalledWith("DATABASE_PATH not set, defaulting to 'pluralscape.db'");
  });
});
