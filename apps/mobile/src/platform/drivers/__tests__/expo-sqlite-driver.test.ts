import { describe, expect, it, vi } from "vitest";

// Mock expo-sqlite since it's not available in vitest
vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({
    prepareSync: vi.fn(() => ({
      executeSync: vi.fn(() => ({
        getAllSync: vi.fn(() => []),
        getFirstSync: vi.fn(() => null),
      })),
    })),
    execSync: vi.fn(),
    withTransactionSync: vi.fn((fn: () => void) => {
      fn();
    }),
    closeSync: vi.fn(),
  })),
}));

import { createExpoSqliteDriver } from "../expo-sqlite-driver.js";

describe("createExpoSqliteDriver", () => {
  it("returns an object implementing SqliteDriver", async () => {
    const driver = await createExpoSqliteDriver();
    expect(driver).toHaveProperty("prepare");
    expect(driver).toHaveProperty("exec");
    expect(driver).toHaveProperty("transaction");
    expect(driver).toHaveProperty("close");
  });

  it("prepare returns a statement with run, all, get methods", async () => {
    const driver = await createExpoSqliteDriver();
    const stmt = driver.prepare("SELECT 1");
    expect(stmt).toHaveProperty("run");
    expect(stmt).toHaveProperty("all");
    expect(stmt).toHaveProperty("get");
  });
});
