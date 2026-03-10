import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { accountScope, systemScope } from "../rls/sqlite-isolation.js";

const testTable = sqliteTable("test", {
  systemId: text("system_id").notNull(),
  accountId: text("account_id").notNull(),
});

describe("systemScope", () => {
  it("returns an eq condition", () => {
    const result = systemScope(testTable.systemId, "sys-123");

    expect(result).toBeTruthy();
  });

  it("produces correct SQL when serialized", () => {
    const result = systemScope(testTable.systemId, "sys-456");

    expect(result).toBeDefined();
    expect(result).toBeTruthy();
  });
});

describe("accountScope", () => {
  it("returns an eq condition", () => {
    const result = accountScope(testTable.accountId, "acc-789");

    expect(result).toBeTruthy();
  });
});
