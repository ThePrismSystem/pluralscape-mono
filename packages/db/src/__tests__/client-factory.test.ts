import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock better-sqlite3 and its drizzle adapter so tests work without the native module
vi.mock("better-sqlite3", () => {
  class FakeDatabase {
    pragma = vi.fn();
  }
  return { default: FakeDatabase };
});

vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({ fake: true })),
}));

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

describe("SQLCipher encryption", () => {
  let tempDir: string | undefined;
  let rawHandle: Database.Database | undefined;

  afterEach(() => {
    if (rawHandle?.open) rawHandle.close();
    rawHandle = undefined;
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    tempDir = undefined;
  });

  // 32-byte hex key (64 hex chars) — required for AES-256
  const TEST_KEY = "a".repeat(64);
  const WRONG_KEY = "b".repeat(64);

  /** Opens a raw SQLCipher connection, writes test data, and closes it. */
  function writeEncryptedTestData(dbPath: string, key: string): void {
    const client = new Database(dbPath);
    client.pragma(`cipher='sqlcipher'`);
    client.pragma(`key="x'${key}'"`);
    client.pragma("journal_mode = WAL");
    client.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
    client.exec(`INSERT INTO test (id, value) VALUES (1, 'secret')`);
    client.close();
  }

  it("creates an encrypted database that cannot be read without the key", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "sqlcipher-test-"));
    const dbPath = join(tempDir, "encrypted.db");

    writeEncryptedTestData(dbPath, TEST_KEY);

    // Opening without key should fail — the file header is encrypted,
    // so SQLite sees it as "not a database".
    rawHandle = new Database(dbPath);
    expect(() => {
      rawHandle?.prepare("SELECT * FROM test").all();
    }).toThrow(/file is not a database/);

    // Opening via createDatabase with the correct key should succeed —
    // this verifies the factory sets up cipher/key pragmas correctly.
    const decrypted = await createDatabase({
      dialect: "sqlite",
      filename: dbPath,
      encryptionKey: TEST_KEY,
    });
    expect(decrypted.dialect).toBe("sqlite");
    expect(decrypted.db).toBeDefined();

    // Verify data is readable via a raw keyed connection
    const verify = new Database(dbPath);
    verify.pragma(`cipher='sqlcipher'`);
    verify.pragma(`key="x'${TEST_KEY}'"`);
    const rows = verify.prepare("SELECT * FROM test").all();
    verify.close();
    expect(rows).toHaveLength(1);
    expect((rows[0] as Record<string, unknown>).value).toBe("secret");
  });

  it("rejects a wrong key on an existing encrypted database", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "sqlcipher-test-"));
    const dbPath = join(tempDir, "encrypted.db");

    writeEncryptedTestData(dbPath, TEST_KEY);

    // A different valid-format key should fail — the WAL pragma inside
    // createDatabase() triggers a page read that detects the mismatch.
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: dbPath,
        encryptionKey: WRONG_KEY,
      }),
    ).rejects.toThrow(/file is not a database/);
  });

  it("rejects non-hex encryption keys", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "not-a-hex-key",
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a");
  });

  it("rejects odd-length hex keys", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "abc",
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a");
  });

  it("rejects keys shorter than 64 hex characters", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "aa",
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a");
  });

  it("rejects keys longer than 64 hex characters", async () => {
    await expect(
      createDatabase({
        dialect: "sqlite",
        filename: ":memory:",
        encryptionKey: "a".repeat(128),
      }),
    ).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a");
  });
});

describe("createDatabaseFromEnv", () => {
  const originalDialect = process.env["DB_DIALECT"];
  const originalUrl = process.env["DATABASE_URL"];
  const originalPath = process.env["DATABASE_PATH"];
  const originalEncKey = process.env["SQLITE_ENCRYPTION_KEY"];

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
    if (originalEncKey === undefined) {
      delete process.env["SQLITE_ENCRYPTION_KEY"];
    } else {
      process.env["SQLITE_ENCRYPTION_KEY"] = originalEncKey;
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
    delete process.env["SQLITE_ENCRYPTION_KEY"];
    const client = await createDatabaseFromEnv();
    expect(client.dialect).toBe("sqlite");
    expect(client.db).toBeDefined();
  });

  it("warns and defaults when DATABASE_PATH is not set", async () => {
    process.env["DB_DIALECT"] = "sqlite";
    delete process.env["DATABASE_PATH"];
    delete process.env["SQLITE_ENCRYPTION_KEY"];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = await createDatabaseFromEnv();
    expect(client.dialect).toBe("sqlite");
    expect(warnSpy).toHaveBeenCalledWith("DATABASE_PATH not set, defaulting to 'pluralscape.db'");
  });

  it("throws when SQLITE_ENCRYPTION_KEY is set but empty", async () => {
    process.env["DB_DIALECT"] = "sqlite";
    process.env["DATABASE_PATH"] = ":memory:";
    process.env["SQLITE_ENCRYPTION_KEY"] = "";
    await expect(createDatabaseFromEnv()).rejects.toThrow("SQLITE_ENCRYPTION_KEY is set but empty");
  });

  it("passes SQLITE_ENCRYPTION_KEY through to createDatabase", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sqlcipher-env-test-"));
    try {
      process.env["DB_DIALECT"] = "sqlite";
      process.env["DATABASE_PATH"] = join(dir, "enc.db");
      process.env["SQLITE_ENCRYPTION_KEY"] = "a".repeat(64);
      const client = await createDatabaseFromEnv();
      expect(client.dialect).toBe("sqlite");
      expect(client.db).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("rejects an invalid SQLITE_ENCRYPTION_KEY from env", async () => {
    process.env["DB_DIALECT"] = "sqlite";
    process.env["DATABASE_PATH"] = ":memory:";
    process.env["SQLITE_ENCRYPTION_KEY"] = "too-short";
    await expect(createDatabaseFromEnv()).rejects.toThrow("SQLITE_ENCRYPTION_KEY must be a");
  });
});
