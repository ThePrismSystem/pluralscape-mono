import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgImportExportTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createImportJob } from "../../../../services/system/import-jobs/create.js";
import { getImportJob } from "../../../../services/system/import-jobs/get.js";
import { listImportJobs } from "../../../../services/system/import-jobs/list.js";
import { updateImportJob } from "../../../../services/system/import-jobs/update.js";
import { asDb, assertApiError, makeAuth, noopAudit } from "../../../helpers/integration-setup.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type {
  AccountId,
  ImportCheckpointState,
  ImportJobId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { importJobs } = schema;

function makeCheckpointState(): ImportCheckpointState {
  return {
    schemaVersion: 2,
    checkpoint: {
      completedCollections: ["member"],
      currentCollection: "group",
      currentCollectionLastSourceId: "src_abc",
      realPrivacyBucketsMapped: true,
    },
    options: {
      selectedCategories: { member: true, group: true },
      avatarMode: "api",
    },
    totals: {
      perCollection: {
        member: { total: 10, imported: 10, updated: 0, skipped: 0, failed: 0 },
      },
    },
  };
}

describe("import-job create/get/list/update (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgImportExportTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(importJobs);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createImportJob", () => {
    it("creates a pending import job with the expected shape", async () => {
      const result = await createImportJob(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          selectedCategories: { member: true, group: true },
          avatarMode: "api",
        },
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^ij_/);
      expect(result.systemId).toBe(systemId);
      expect(result.accountId).toBe(accountId);
      expect(result.source).toBe("simply-plural");
      expect(result.status).toBe("pending");
      expect(result.progressPercent).toBe(0);
      expect(result.chunksCompleted).toBe(0);
      expect(result.chunksTotal).toBeNull();
      expect(result.errorLog).toBeNull();
      expect(result.warningCount).toBe(0);
      expect(result.completedAt).toBeNull();
      expect(result.createdAt).toEqual(expect.any(Number));
      expect(result.updatedAt).toEqual(expect.any(Number));
    });

    it("accepts every valid source", async () => {
      for (const source of ["simply-plural", "pluralkit", "pluralscape"] as const) {
        const result = await createImportJob(
          asDb(db),
          systemId,
          { source, selectedCategories: { member: true }, avatarMode: "skip" },
          auth,
          noopAudit,
        );
        expect(result.source).toBe(source);
      }
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        createImportJob(
          asDb(db),
          otherSystemId,
          { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("rejects invalid payload", async () => {
      await assertApiError(
        createImportJob(
          asDb(db),
          systemId,
          { source: "notion", selectedCategories: {}, avatarMode: "api" } as never,
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getImportJob", () => {
    it("retrieves a created import job", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );

      const result = await getImportJob(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.source).toBe("simply-plural");
    });

    it("returns NOT_FOUND for an unknown id", async () => {
      await assertApiError(
        getImportJob(asDb(db), systemId, brandId<ImportJobId>("ij_does-not-exist"), auth),
        "NOT_FOUND",
        404,
      );
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        getImportJob(asDb(db), otherSystemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listImportJobs", () => {
    it("returns only jobs for the given system", async () => {
      await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      await createImportJob(
        asDb(db),
        systemId,
        { source: "pluralkit", selectedCategories: { member: true }, avatarMode: "skip" },
        auth,
        noopAudit,
      );

      const result = await listImportJobs(asDb(db), systemId, auth, {});
      expect(result.data.length).toBe(2);
      expect(result.data.map((job) => job.source).sort()).toEqual(["pluralkit", "simply-plural"]);
    });

    it("filters by status", async () => {
      const job = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      await updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit);
      await createImportJob(
        asDb(db),
        systemId,
        { source: "pluralkit", selectedCategories: { member: true }, avatarMode: "skip" },
        auth,
        noopAudit,
      );

      const result = await listImportJobs(asDb(db), systemId, auth, { status: "importing" });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.status).toBe("importing");
    });

    it("filters by source", async () => {
      await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      await createImportJob(
        asDb(db),
        systemId,
        { source: "pluralkit", selectedCategories: { member: true }, avatarMode: "skip" },
        auth,
        noopAudit,
      );

      const result = await listImportJobs(asDb(db), systemId, auth, { source: "pluralkit" });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.source).toBe("pluralkit");
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(listImportJobs(asDb(db), otherSystemId, auth, {}), "NOT_FOUND", 404);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateImportJob", () => {
    it("updates status and progressPercent", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );

      const result = await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        { status: "importing", progressPercent: 42 },
        auth,
        noopAudit,
      );

      expect(result.status).toBe("importing");
      expect(result.progressPercent).toBe(42);
      expect(result.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it("sets completedAt when status transitions to completed", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );

      await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        { status: "importing" },
        auth,
        noopAudit,
      );
      const result = await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        { status: "completed", progressPercent: 100 },
        auth,
        noopAudit,
      );

      expect(result.status).toBe("completed");
      expect(result.completedAt).not.toBeNull();
    });

    it("sets completedAt when status transitions to failed", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );

      const result = await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        { status: "failed" },
        auth,
        noopAudit,
      );

      expect(result.status).toBe("failed");
      expect(result.completedAt).not.toBeNull();
    });

    it("persists checkpointState", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      const state = makeCheckpointState();

      const result = await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        { checkpointState: state },
        auth,
        noopAudit,
      );

      const fetched = await getImportJob(asDb(db), systemId, result.id, auth);
      expect(fetched.checkpointState).toEqual(state);
    });

    it("persists errorLog entries", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );

      const result = await updateImportJob(
        asDb(db),
        systemId,
        created.id,
        {
          errorLog: [
            {
              entityType: "member",
              entityId: "abc",
              message: "failed to import",
              fatal: false,
            },
          ],
        },
        auth,
        noopAudit,
      );

      expect(result.errorLog).toHaveLength(1);
      expect(result.errorLog?.[0]?.message).toBe("failed to import");
    });

    it("returns NOT_FOUND for an unknown id", async () => {
      await assertApiError(
        updateImportJob(
          asDb(db),
          systemId,
          brandId<ImportJobId>("ij_does-not-exist"),
          { status: "importing" },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const created = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        updateImportJob(
          asDb(db),
          otherSystemId,
          created.id,
          { status: "importing" },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });
});
