import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { sqliteCleanupDeviceTransfers } from "../queries/device-transfer-cleanup.js";
import { accounts, deviceTransferRequests, sessions } from "../schema/sqlite/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { createSqliteAuthTables, sqliteInsertAccount } from "./helpers/sqlite-helpers.js";

import type { AccountId, DeviceTransferRequestId, SessionId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const ONE_HOUR_MS = 3_600_000;
const TEST_CODE_SALT = new Uint8Array(16);

const schema = { accounts, sessions, deviceTransferRequests };

describe("sqliteCleanupDeviceTransfers", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  function insertSession(accountId: AccountId): SessionId {
    const id = brandId<SessionId>(crypto.randomUUID());
    db.insert(sessions)
      .values({
        id,
        accountId,
        tokenHash: `tok_${crypto.randomUUID()}`,
        createdAt: fixtureNow(),
      })
      .run();
    return id;
  }

  function insertTransfer(opts: {
    accountId: AccountId;
    sourceSessionId: SessionId;
    status?: "pending" | "approved" | "expired";
    createdAt?: UnixMillis;
    expiresAt?: UnixMillis;
    encryptedKeyMaterial?: Uint8Array;
  }): DeviceTransferRequestId {
    const id = brandId<DeviceTransferRequestId>(crypto.randomUUID());
    const now = fixtureNow();
    db.insert(deviceTransferRequests)
      .values({
        id,
        accountId: opts.accountId,
        sourceSessionId: opts.sourceSessionId,
        status: opts.status ?? "pending",
        codeSalt: TEST_CODE_SALT,
        encryptedKeyMaterial: opts.encryptedKeyMaterial ?? null,
        createdAt: opts.createdAt ?? toUnixMillis(now - ONE_HOUR_MS),
        expiresAt: opts.expiresAt ?? toUnixMillis(now + ONE_HOUR_MS),
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAuthTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(deviceTransferRequests).run();
    db.delete(sessions).run();
    db.delete(accounts).run();
  });

  it("expires pending transfers past their expiresAt", () => {
    const accountId = sqliteInsertAccount(db);
    const sessionId = insertSession(accountId);
    const now = fixtureNow();

    // Expired pending transfer (expiresAt in the past)
    const expiredId = insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "pending",
      createdAt: toUnixMillis(now - ONE_HOUR_MS * 2),
      expiresAt: toUnixMillis(now - ONE_HOUR_MS),
    });

    // Non-expired pending transfer (expiresAt in the future)
    const activeId = insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "pending",
      createdAt: toUnixMillis(now - ONE_HOUR_MS),
      expiresAt: toUnixMillis(now + ONE_HOUR_MS),
    });

    const result = sqliteCleanupDeviceTransfers(db);
    expect(result.deletedCount).toBe(1);

    const rows = db.select().from(deviceTransferRequests).all();
    const expired = rows.find((r) => r.id === expiredId);
    const active = rows.find((r) => r.id === activeId);

    expect(expired?.status).toBe("expired");
    expect(active?.status).toBe("pending");
  });

  it("does not touch already-approved transfers", () => {
    const accountId = sqliteInsertAccount(db);
    const sessionId = insertSession(accountId);
    const now = fixtureNow();

    insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "approved",
      encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
      createdAt: toUnixMillis(now - ONE_HOUR_MS * 2),
      expiresAt: toUnixMillis(now - ONE_HOUR_MS),
    });

    const result = sqliteCleanupDeviceTransfers(db);
    expect(result.deletedCount).toBe(0);

    const rows = db.select().from(deviceTransferRequests).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("approved");
  });

  it("does not touch already-expired transfers", () => {
    const accountId = sqliteInsertAccount(db);
    const sessionId = insertSession(accountId);
    const now = fixtureNow();

    insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "expired",
      createdAt: toUnixMillis(now - ONE_HOUR_MS * 2),
      expiresAt: toUnixMillis(now - ONE_HOUR_MS),
    });

    const result = sqliteCleanupDeviceTransfers(db);
    expect(result.deletedCount).toBe(0);
  });

  it("returns 0 when nothing to clean", () => {
    const result = sqliteCleanupDeviceTransfers(db);
    expect(result.deletedCount).toBe(0);
  });

  it("expires multiple pending transfers in a single pass", () => {
    const accountId = sqliteInsertAccount(db);
    const sessionId = insertSession(accountId);
    const now = fixtureNow();

    insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "pending",
      createdAt: toUnixMillis(now - ONE_HOUR_MS * 3),
      expiresAt: toUnixMillis(now - ONE_HOUR_MS * 2),
    });

    insertTransfer({
      accountId,
      sourceSessionId: sessionId,
      status: "pending",
      createdAt: toUnixMillis(now - ONE_HOUR_MS * 2),
      expiresAt: toUnixMillis(now - ONE_HOUR_MS),
    });

    const result = sqliteCleanupDeviceTransfers(db);
    expect(result.deletedCount).toBe(2);

    const rows = db.select().from(deviceTransferRequests).all();
    expect(rows.every((r) => r.status === "expired")).toBe(true);
  });
});
