import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgImportExportTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createImportJob } from "../../../../services/system/import-jobs/create.js";
import { getImportJob } from "../../../../services/system/import-jobs/get.js";
import { listImportJobs } from "../../../../services/system/import-jobs/list.js";
import { updateImportJob } from "../../../../services/system/import-jobs/update.js";
import { spyAudit } from "../../../helpers/audit-assertions.js";
import { asDb, assertApiError, makeAuth, noopAudit } from "../../../helpers/integration-setup.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { AccountId, ImportJobId, ImportJobStatus, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { importJobs } = schema;

describe("import-job state machine, seeding, audit, pagination (PGlite integration)", () => {
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

  async function driveJobToStatus(
    id: ImportJobId,
    target: "pending" | "validating" | "importing" | "completed" | "failed",
  ): Promise<void> {
    const path: readonly ImportJobStatus[] = (() => {
      switch (target) {
        case "pending":
          return [];
        case "validating":
          return ["validating"];
        case "importing":
          return ["validating", "importing"];
        case "completed":
          return ["validating", "importing", "completed"];
        case "failed":
          return ["validating", "importing", "failed"];
      }
    })();
    for (const status of path) {
      await updateImportJob(asDb(db), systemId, id, { status }, auth, noopAudit);
    }
  }

  // ── State machine ────────────────────────────────────────────────

  describe("updateImportJob state machine enforcement", () => {
    const createBody = {
      source: "simply-plural" as const,
      selectedCategories: { member: true },
      avatarMode: "api" as const,
    };

    it("allows pending → validating", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      const updated = await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        { status: "validating" },
        auth,
        noopAudit,
      );
      expect(updated.status).toBe("validating");
    });

    it("allows validating → importing", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "validating");
      const updated = await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        { status: "importing" },
        auth,
        noopAudit,
      );
      expect(updated.status).toBe("importing");
    });

    it("allows importing → completed", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "importing");
      const updated = await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        { status: "completed" },
        auth,
        noopAudit,
      );
      expect(updated.status).toBe("completed");
      expect(updated.completedAt).not.toBeNull();
    });

    it("refuses completed → pending with INVALID_STATE 409", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "completed");
      await assertApiError(
        updateImportJob(asDb(db), systemId, job.id, { status: "pending" }, auth, noopAudit),
        "INVALID_STATE",
        409,
      );
    });

    it("refuses completed → importing (terminal immutability)", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "completed");
      await assertApiError(
        updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit),
        "INVALID_STATE",
        409,
      );
    });

    it("refuses pending → completed (must go through importing)", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await assertApiError(
        updateImportJob(asDb(db), systemId, job.id, { status: "completed" }, auth, noopAudit),
        "INVALID_STATE",
        409,
      );
    });

    it("failed → importing is refused without a recoverable error in the log", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "importing");
      await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        {
          status: "failed",
          errorLog: [
            {
              entityType: "member",
              entityId: null,
              message: "disk full",
              fatal: true,
              recoverable: false,
            },
          ],
        },
        auth,
        noopAudit,
      );
      await assertApiError(
        updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit),
        "INVALID_STATE",
        409,
      );
    });

    it("failed → importing succeeds when last error is fatal + recoverable", async () => {
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await driveJobToStatus(job.id, "importing");
      await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        {
          status: "failed",
          errorLog: [
            {
              entityType: "member",
              entityId: null,
              message: "token expired",
              fatal: true,
              recoverable: true,
            },
          ],
        },
        auth,
        noopAudit,
      );
      const resumed = await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        { status: "importing" },
        auth,
        noopAudit,
      );
      expect(resumed.status).toBe("importing");
      expect(resumed.completedAt).toBeNull();
    });
  });

  // ── Checkpoint seeding ───────────────────────────────────────────

  describe("createImportJob checkpoint seeding", () => {
    it("writes an initial checkpointState with the provided options", async () => {
      const job = await createImportJob(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          selectedCategories: { member: true, group: true, poll: false },
          avatarMode: "api",
        },
        auth,
        noopAudit,
      );
      expect(job.checkpointState).not.toBeNull();
      expect(job.checkpointState?.schemaVersion).toBe(2);
      expect(job.checkpointState?.options.selectedCategories).toEqual({
        member: true,
        group: true,
        poll: false,
      });
      expect(job.checkpointState?.options.avatarMode).toBe("api");
      expect(job.checkpointState?.checkpoint.currentCollection).toBe("member");
      expect(job.checkpointState?.checkpoint.completedCollections).toEqual([]);
      expect(job.checkpointState?.checkpoint.currentCollectionLastSourceId).toBeNull();
      expect(job.checkpointState?.totals.perCollection).toEqual({});
    });

    it("picks the first selected collection in canonical order", async () => {
      const job = await createImportJob(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          selectedCategories: { poll: true, group: true },
          avatarMode: "skip",
        },
        auth,
        noopAudit,
      );
      // Canonical order: member, group, fronting-session, switch, ...
      // First TRUE is "group" (member is absent/falsy).
      expect(job.checkpointState?.checkpoint.currentCollection).toBe("group");
    });
  });

  // ── Audit events ─────────────────────────────────────────────────

  describe("updateImportJob audit events", () => {
    const createBody = {
      source: "simply-plural" as const,
      selectedCategories: { member: true },
      avatarMode: "api" as const,
    };

    it("emits import-job.created on create", async () => {
      const audit = spyAudit();
      await createImportJob(asDb(db), systemId, createBody, auth, audit);
      expect(audit.calls.some((c) => c.eventType === "import-job.created")).toBe(true);
    });

    it("emits import-job.updated on progress update (non-terminal)", async () => {
      const audit = spyAudit();
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit);
      await updateImportJob(asDb(db), systemId, job.id, { progressPercent: 50 }, auth, audit);
      expect(audit.calls[audit.calls.length - 1]?.eventType).toBe("import-job.updated");
    });

    it("emits import-job.completed on terminal success", async () => {
      const audit = spyAudit();
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit);
      await updateImportJob(asDb(db), systemId, job.id, { status: "completed" }, auth, audit);
      expect(audit.calls.some((c) => c.eventType === "import-job.completed")).toBe(true);
    });

    it("emits import-job.failed on terminal failure", async () => {
      const audit = spyAudit();
      const job = await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      await updateImportJob(asDb(db), systemId, job.id, { status: "importing" }, auth, noopAudit);
      await updateImportJob(
        asDb(db),
        systemId,
        job.id,
        {
          status: "failed",
          errorLog: [
            {
              entityType: "member",
              entityId: null,
              message: "boom",
              fatal: true,
              recoverable: false,
            },
          ],
        },
        auth,
        audit,
      );
      expect(audit.calls.some((c) => c.eventType === "import-job.failed")).toBe(true);
    });
  });

  // ── Pagination and limit clamping ────────────────────────────────

  describe("listImportJobs pagination and limit clamping", () => {
    const createBody = {
      source: "simply-plural" as const,
      selectedCategories: { member: true },
      avatarMode: "api" as const,
    };

    it("paginates with cursor over 15 jobs in pages of 5", async () => {
      for (let i = 0; i < 15; i++) {
        await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      }

      const page1 = await listImportJobs(asDb(db), systemId, auth, { limit: 5 });
      expect(page1.data).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listImportJobs(asDb(db), systemId, auth, {
        limit: 5,
        cursor: page1.nextCursor ?? undefined,
      });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(true);

      const page3 = await listImportJobs(asDb(db), systemId, auth, {
        limit: 5,
        cursor: page2.nextCursor ?? undefined,
      });
      expect(page3.data).toHaveLength(5);
      expect(page3.hasMore).toBe(false);

      // No overlap across pages
      const ids = new Set([
        ...page1.data.map((j) => j.id),
        ...page2.data.map((j) => j.id),
        ...page3.data.map((j) => j.id),
      ]);
      expect(ids.size).toBe(15);
    });

    it("clamps limit to MAX_PAGE_LIMIT (100)", async () => {
      for (let i = 0; i < 3; i++) {
        await createImportJob(asDb(db), systemId, createBody, auth, noopAudit);
      }
      const result = await listImportJobs(asDb(db), systemId, auth, { limit: 99999 });
      expect(result.data.length).toBeLessThanOrEqual(100);
    });
  });

  // ── Corrupt JSONB handling ────────────────────────────────────────

  describe("getImportJob corrupt JSONB handling", () => {
    it("throws INTERNAL_ERROR when errorLog has wrong shape", async () => {
      const job = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      await db.execute(sql`
        UPDATE import_jobs
        SET error_log = '[{"garbage": true}]'::jsonb
        WHERE id = ${job.id}
      `);

      await assertApiError(getImportJob(asDb(db), systemId, job.id, auth), "INTERNAL_ERROR", 500);
    });

    it("throws INTERNAL_ERROR when checkpointState has wrong shape", async () => {
      const job = await createImportJob(
        asDb(db),
        systemId,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        auth,
        noopAudit,
      );
      await db.execute(sql`
        UPDATE import_jobs
        SET checkpoint_state = '{"schemaVersion": 99}'::jsonb
        WHERE id = ${job.id}
      `);

      await assertApiError(getImportJob(asDb(db), systemId, job.id, auth), "INTERNAL_ERROR", 500);
    });
  });
});
