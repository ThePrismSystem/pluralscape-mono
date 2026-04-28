import { getTableColumns } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, test } from "vitest";

import { assertStructuralColumnsEquivalent } from "../three-way-parity.js";

describe("assertStructuralColumnsEquivalent", () => {
  test("passes when structural columns match", () => {
    const server = sqliteTable("a_server", {
      id: text("id").primaryKey(),
      systemId: text("system_id").notNull(),
      encryptedData: text("encrypted_data").notNull(),
      createdAt: integer("created_at").notNull(),
    });
    const cache = sqliteTable("a_cache", {
      id: text("id").primaryKey(),
      systemId: text("system_id").notNull(),
      name: text("name").notNull(),
      createdAt: integer("created_at").notNull(),
    });

    expect(() => {
      assertStructuralColumnsEquivalent(getTableColumns(server), getTableColumns(cache), {
        skip: ["encryptedData", "version", "name"],
      });
    }).not.toThrow();
  });

  test("throws when cache is missing a structural column", () => {
    const server = sqliteTable("b_server", {
      id: text("id").primaryKey(),
      systemId: text("system_id").notNull(),
    });
    const cache = sqliteTable("b_cache", { id: text("id").primaryKey() });

    expect(() => {
      assertStructuralColumnsEquivalent(getTableColumns(server), getTableColumns(cache), {
        skip: [],
      });
    }).toThrow(/missing structural column "systemId"/);
  });

  test("throws when notNull differs between schemas", () => {
    const server = sqliteTable("c_server", {
      id: text("id").primaryKey(),
      systemId: text("system_id").notNull(),
    });
    const cache = sqliteTable("c_cache", {
      id: text("id").primaryKey(),
      systemId: text("system_id"),
    });

    expect(() => {
      assertStructuralColumnsEquivalent(getTableColumns(server), getTableColumns(cache), {
        skip: [],
      });
    }).toThrow(/notNull mismatch/);
  });
});
