import Database from "better-sqlite3";
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

      const dateRange = { start: now - 86400000, end: now };
      const memberBreakdowns = [
        {
          memberId: "mem_abc",
          totalDuration: 3600000,
          sessionCount: 5,
          averageSessionLength: 720000,
          percentageOfTotal: 45.5,
        },
      ];
      const chartData = [
        {
          chartType: "pie" as const,
          labels: ["Alice", "Bob"],
          datasets: [{ label: "Duration", data: [60, 40], color: "#ff0000" }],
        },
      ];

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          dateRange,
          memberBreakdowns,
          chartData,
          format: "html",
          generatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.dateRange).toEqual(dateRange);
      expect(rows[0]?.memberBreakdowns).toEqual(memberBreakdowns);
      expect(rows[0]?.chartData).toEqual(chartData);
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
          dateRange: { start: now - 86400000, end: now },
          memberBreakdowns: [],
          chartData: [],
          format: "pdf",
          generatedAt: now,
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
            dateRange: { start: now - 86400000, end: now },
            memberBreakdowns: [],
            chartData: [],
            format: "docx" as "html",
            generatedAt: now,
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
          dateRange: { start: now - 86400000, end: now },
          memberBreakdowns: [],
          chartData: [],
          format: "html",
          generatedAt: now,
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
            dateRange: { start: now - 86400000, end: now },
            memberBreakdowns: [],
            chartData: [],
            format: "html",
            generatedAt: now,
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
        dateRange: { start: now - 86400000, end: now },
        memberBreakdowns: [],
        chartData: [],
        format: "html" as const,
        generatedAt: now,
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
            dateRange: { start: now - 86400000, end: now },
            memberBreakdowns: [],
            chartData: [],
            format: "html",
            generatedAt: now,
          },
          {
            id: crypto.randomUUID(),
            systemId,
            dateRange: { start: now - 172800000, end: now - 86400000 },
            memberBreakdowns: [],
            chartData: [],
            format: "pdf",
            generatedAt: now,
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

    it("round-trips complex chart data with multiple datasets", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      const chartData = [
        {
          chartType: "bar" as const,
          labels: ["Mon", "Tue", "Wed"],
          datasets: [
            { label: "Alice", data: [3, 5, 2], color: "#ff0000" },
            { label: "Bob", data: [1, 4, 6], color: "#00ff00" },
          ],
        },
        {
          chartType: "timeline" as const,
          labels: ["2024-01-01", "2024-01-02"],
          datasets: [{ label: "Fronting", data: [8, 12], color: "#0000ff" }],
        },
      ];

      db.insert(frontingReports)
        .values({
          id,
          systemId,
          dateRange: { start: now - 604800000, end: now },
          memberBreakdowns: [],
          chartData,
          format: "html",
          generatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingReports).where(eq(frontingReports.id, id)).all();
      expect(rows[0]?.chartData).toEqual(chartData);
    });
  });
});
