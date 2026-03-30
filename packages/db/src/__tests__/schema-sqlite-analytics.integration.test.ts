import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { frontingReports } from "../schema/sqlite/analytics.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteAnalyticsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, frontingReports };

describe("SQLite analytics schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAnalyticsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(frontingReports).run();
  });

  describe("fronting_reports", () => {
    it("round-trips all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const blob = testBlob();

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          encryptedData: blob,
          format: "html",
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.encryptedData).toEqual(blob);
      expect(rows[0]?.format).toBe("html");
      expect(rows[0]?.generatedAt).toBe(now);
    });

    it("accepts pdf format", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          encryptedData: testBlob(),
          format: "pdf",
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows[0]?.format).toBe("pdf");
    });

    it("rejects invalid format value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingReports)
          .values({
            id: crypto.randomUUID(),
            systemId,
            encryptedData: testBlob(),
            format: "docx" as "html",
            generatedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          encryptedData: testBlob(),
          format: "html",
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(frontingReports)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            encryptedData: testBlob(),
            format: "html",
            generatedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate primary key", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const values = {
        id,
        systemId,
        encryptedData: testBlob(),
        format: "html" as const,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(frontingReports).values(values).run();
      expect(() => db.insert(frontingReports).values(values).run()).toThrow();
    });

    it("queries multiple reports by systemId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(frontingReports)
        .values([
          {
            id: crypto.randomUUID(),
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            format: "html",
            generatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: crypto.randomUUID(),
            systemId,
            encryptedData: testBlob(new Uint8Array([2])),
            format: "pdf",
            generatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const rows = db
        .select()
        .from(frontingReports)
        .where(eq(frontingReports.systemId, systemId))
        .all();
      expect(rows).toHaveLength(2);
    });

    it("round-trips distinct ciphertext payloads", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const blob = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          encryptedData: blob,
          format: "html",
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows[0]?.encryptedData).toEqual(blob);
    });
  });
});
