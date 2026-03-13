import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabase, createDatabaseFromEnv } from "../client/factory.js";

describe("createDatabase", () => {
  it("returns a SQLite client when given sqlite config", async () => {
    const client = await createDatabase({ dialect: "sqlite", filename: ":memory:" });
    expect(client.dialect).toBe("sqlite");
    expect(client.db).toBeDefined();
  });
});

describe("SQLCipher encryption", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  // 32-byte hex key (64 hex chars)
  const TEST_KEY = "a".repeat(64);

  it("creates an encrypted database that cannot be read without the key", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "sqlcipher-test-"));
    const dbPath = join(tempDir, "encrypted.db");

    // Create and write data with encryption
    const encrypted = await createDatabase({
      dialect: "sqlite",
      filename: dbPath,
      encryptionKey: TEST_KEY,
    });
    encrypted.db.run(/* sql */ `CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
    encrypted.db.run(/* sql */ `INSERT INTO test (id, value) VALUES (1, 'secret')`);

    // Opening without key should fail — the file header is encrypted,
    // so SQLite sees it as "not a database".
    const Database = (await import("better-sqlite3-multiple-ciphers")).default;
    expect(() => {
      const raw = new Database(dbPath);
      raw.pragma("journal_mode = WAL");
      raw.prepare("SELECT * FROM test").all();
    }).toThrow(/file is not a database/);

    // Opening with the correct key should succeed
    const decrypted = await createDatabase({
      dialect: "sqlite",
      filename: dbPath,
      encryptionKey: TEST_KEY,
    });
    const rows = decrypted.db.all(/* sql */ `SELECT * FROM test`);
    expect(rows).toHaveLength(1);
    expect((rows[0] as Record<string, unknown>).value).toBe("secret");
  });

  it("rejects non-hex encryption keys", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "not-a-hex-key",
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a hex-encoded key");
  });

  it("rejects odd-length hex keys", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "abc",
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a hex-encoded key");
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
