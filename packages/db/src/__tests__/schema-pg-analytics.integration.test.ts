import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { frontingReports } from "../schema/pg/analytics.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgAnalyticsTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

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
      const blob = testBlob();

      await db.insert(frontingReports).values({
        id,
        systemId,
        encryptedData: blob,
        format: "html",
        generatedAt: now,
      });

      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.encryptedData).toEqual(blob);
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
        encryptedData: testBlob(),
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
          encryptedData: testBlob(),
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
        encryptedData: testBlob(),
        format: "html",
        generatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(frontingReports).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          encryptedData: testBlob(),
          format: "html",
          generatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate primary key", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const values = {
        id,
        systemId,
        encryptedData: testBlob(),
        format: "html" as const,
        generatedAt: now,
      };

      await db.insert(frontingReports).values(values);
      await expect(db.insert(frontingReports).values(values)).rejects.toThrow();
    });

    it("queries multiple reports by systemId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(frontingReports).values([
        {
          id: crypto.randomUUID(),
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          format: "html",
          generatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          systemId,
          encryptedData: testBlob(new Uint8Array([2])),
          format: "pdf",
          generatedAt: now,
        },
      ]);

      const rows = await db
        .select()
        .from(frontingReports)
        .where(eq(frontingReports.systemId, systemId));
      expect(rows).toHaveLength(2);
    });

    it("round-trips distinct ciphertext payloads", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const blob = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingReports).values({
        id,
        systemId,
        encryptedData: blob,
        format: "html",
        generatedAt: now,
      });

      const rows = await db.select().from(frontingReports).where(eq(frontingReports.id, id));
      expect(rows[0]?.encryptedData).toEqual(blob);
    });
  });
});
