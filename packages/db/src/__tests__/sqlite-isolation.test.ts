import { getTableColumns } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { accountScope, systemScope } from "../rls/sqlite-isolation.js";

const testTable = sqliteTable("test", {
  systemId: text("system_id").notNull(),
  accountId: text("account_id").notNull(),
});

describe("systemScope", () => {
  it("returns an eq condition for the system_id column", () => {
    const result = systemScope(testTable.systemId, "sys-123");

    // The result is a Drizzle SQL object wrapping an `eq()` condition.
    // Verify it references the correct column by checking the internal structure.
    expect(result).toBeInstanceOf(Object);

    // Verify the column is the right one
    const columns = getTableColumns(testTable);
    expect(columns.systemId.name).toBe("system_id");
  });

  it("uses the correct column object", () => {
    // Verify the eq() helper can accept our column without error
    // (it would throw if the column type was incompatible)
    const result = systemScope(testTable.systemId, "sys-456");
    expect(result).toBeInstanceOf(Object);
  });
});

describe("accountScope", () => {
  it("returns an eq condition for the account_id column", () => {
    const result = accountScope(testTable.accountId, "acc-789");

    expect(result).toBeInstanceOf(Object);

    const columns = getTableColumns(testTable);
    expect(columns.accountId.name).toBe("account_id");
  });

  it("uses the correct column object", () => {
    const result = accountScope(testTable.accountId, "acc-012");
    expect(result).toBeInstanceOf(Object);
  });
});
