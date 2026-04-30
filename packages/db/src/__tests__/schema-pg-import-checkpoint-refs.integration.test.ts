import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { importEntityRefs, importJobs } from "../schema/pg/import-export.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearImportExportTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  setupImportExportFixture,
  teardownImportExportFixture,
  type ImportExportDb,
} from "./helpers/import-export-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { ImportCheckpointState, ImportJobId, ServerInternal } from "@pluralscape/types";

describe("PG import-export schema — checkpoint state & entity refs", () => {
  let client: PGlite;
  let db: ImportExportDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);

  beforeAll(async () => {
    const fixture = await setupImportExportFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownImportExportFixture({ client, db });
  });

  afterEach(async () => {
    await clearImportExportTables(db);
  });

  describe("import_jobs.checkpoint_state", () => {
    it("persists a full ImportCheckpointState as JSONB", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      const state: ImportCheckpointState = {
        schemaVersion: 2,
        checkpoint: {
          completedCollections: ["member"],
          currentCollection: "fronting-session",
          currentCollectionLastSourceId: "507f1f77bcf86cd799439011",
          realPrivacyBucketsMapped: true,
        },
        options: {
          selectedCategories: {
            member: true,
            group: true,
          } as Record<string, boolean | undefined>,
          avatarMode: "api",
        },
        totals: {
          perCollection: {
            member: { total: 20, imported: 20, updated: 0, skipped: 0, failed: 0 },
          } as Record<
            string,
            | { total: number; imported: number; updated: number; skipped: number; failed: number }
            | undefined
          >,
        },
      };

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "importing",
        progressPercent: 25,
        // The DB column is branded `ServerInternal<…>` for wire-strip; tag
        // the literal at the insert site (compile-time only).
        checkpointState: state as ServerInternal<ImportCheckpointState>,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.checkpointState).toEqual(state);
    });

    it("allows null checkpoint_state for jobs that have not started", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "pending",
        progressPercent: 0,
        checkpointState: null,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows[0]?.checkpointState).toBeNull();
    });
  });

  describe("import_entity_refs", () => {
    afterEach(async () => {
      await db.delete(importEntityRefs);
    });

    it("inserts and retrieves a ref", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(importEntityRefs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "507f1f77bcf86cd799439011",
        pluralscapeEntityId: "mem_test_target_01",
        importedAt: now,
      });

      const rows = await db.select().from(importEntityRefs).where(eq(importEntityRefs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe("507f1f77bcf86cd799439011");
      expect(rows[0]?.pluralscapeEntityId).toBe("mem_test_target_01");
      expect(rows[0]?.source).toBe("simply-plural");
    });

    it("enforces unique (account, system, source, type, sourceId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "deadbeefdeadbeefdeadbeef",
        pluralscapeEntityId: "mem_target_a",
        importedAt: now,
      });

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "deadbeefdeadbeefdeadbeef",
          pluralscapeEntityId: "mem_target_b",
          importedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid source via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "not-a-valid-source" as "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "x",
          pluralscapeEntityId: "y",
          importedAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "sys-cascade-check",
        pluralscapeEntityId: "mem_sys_cascade",
        importedAt: fixtureNow(),
      });

      await db.delete(systems).where(eq(systems.id, systemId));

      const remaining = await db
        .select()
        .from(importEntityRefs)
        .where(eq(importEntityRefs.systemId, systemId));
      expect(remaining).toHaveLength(0);
    });

    it("rejects invalid source_entity_type via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "simply-plural",
          sourceEntityType: "not-a-real-type" as never,
          sourceEntityId: "x",
          pluralscapeEntityId: "y",
          importedAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "abc-cascade",
        pluralscapeEntityId: "mem_cascade_target",
        importedAt: fixtureNow(),
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));

      const remaining = await db
        .select()
        .from(importEntityRefs)
        .where(eq(importEntityRefs.accountId, accountId));
      expect(remaining).toHaveLength(0);
    });
  });
});
