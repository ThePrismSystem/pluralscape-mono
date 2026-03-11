import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { frontingReports } from "../schema/pg/analytics.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import { createPgAnalyticsTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, frontingReports };

describe("PG analytics schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAnalyticsTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingReports);
  });

  describe("fronting_reports", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
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

      await db.insert(frontingReports).values({
        id,
        systemId,
        dateRange,
        memberBreakdowns,
        chartData,
        format: "html",
        generatedAt: now,
      });

      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.dateRange).toEqual(dateRange);
      expect(rows[0]?.memberBreakdowns).toEqual(memberBreakdowns);
      expect(rows[0]?.chartData).toEqual(chartData);
      expect(rows[0]?.format).toBe("html");
      expect(rows[0]?.generatedAt).toBe(now);
    });

    it("accepts pdf format", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingReports).values({
        id,
        systemId,
        dateRange: { start: now - 86400000, end: now },
        memberBreakdowns: [],
        chartData: [],
        format: "pdf",
        generatedAt: now,
      });

      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows[0]?.format).toBe("pdf");
    });

    it("rejects invalid format value", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingReports).values({
          id: crypto.randomUUID(),
          systemId,
          dateRange: { start: now - 86400000, end: now },
          memberBreakdowns: [],
          chartData: [],
          format: "docx" as "html",
          generatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingReports).values({
        id,
        systemId,
        dateRange: { start: now - 86400000, end: now },
        memberBreakdowns: [],
        chartData: [],
        format: "html",
        generatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows).toHaveLength(0);
    });

    it("round-trips complex chart data with multiple datasets", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
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

      await db.insert(frontingReports).values({
        id,
        systemId,
        dateRange: { start: now - 604800000, end: now },
        memberBreakdowns: [],
        chartData,
        format: "html",
        generatedAt: now,
      });

      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows[0]?.chartData).toEqual(chartData);
    });
  });
});
