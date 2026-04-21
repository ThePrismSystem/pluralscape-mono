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

import { listImportEntityRefs } from "../../services/system/import-entity-refs/list.js";
import { lookupImportEntityRef } from "../../services/system/import-entity-refs/lookup.js";
import { recordImportEntityRef } from "../../services/system/import-entity-refs/record.js";
import { asDb, assertApiError, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { importEntityRefs } = schema;

describe("import-entity-ref.service (PGlite integration)", () => {
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
    await db.delete(importEntityRefs);
  });

  // ── RECORD ──────────────────────────────────────────────────────

  describe("recordImportEntityRef", () => {
    it("records a new entity ref", async () => {
      const result = await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "507f1f77bcf86cd799439011",
          pluralscapeEntityId: "mem_target_1",
        },
        auth,
      );

      expect(result.id).toMatch(/^ier_/);
      expect(result.systemId).toBe(systemId);
      expect(result.accountId).toBe(accountId);
      expect(result.source).toBe("simply-plural");
      expect(result.sourceEntityType).toBe("member");
      expect(result.sourceEntityId).toBe("507f1f77bcf86cd799439011");
      expect(result.pluralscapeEntityId).toBe("mem_target_1");
      expect(result.importedAt).toEqual(expect.any(Number));
    });

    it("returns the existing row when called with identical input twice (idempotent)", async () => {
      const input = {
        source: "simply-plural" as const,
        sourceEntityType: "member" as const,
        sourceEntityId: "sp-member-idem",
        pluralscapeEntityId: "mem_pluralscape_idem",
      };

      const first = await recordImportEntityRef(asDb(db), systemId, input, auth);
      const second = await recordImportEntityRef(asDb(db), systemId, input, auth);

      expect(second.id).toBe(first.id);
      expect(second.pluralscapeEntityId).toBe(first.pluralscapeEntityId);
    });

    it("throws CONFLICT when the same source entity is re-mapped to a different target", async () => {
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "duplicate",
          pluralscapeEntityId: "mem_first",
        },
        auth,
      );

      await assertApiError(
        recordImportEntityRef(
          asDb(db),
          systemId,
          {
            source: "simply-plural",
            sourceEntityType: "member",
            sourceEntityId: "duplicate",
            pluralscapeEntityId: "mem_second",
          },
          auth,
        ),
        "CONFLICT",
        409,
      );
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        recordImportEntityRef(
          asDb(db),
          otherSystemId,
          {
            source: "simply-plural",
            sourceEntityType: "member",
            sourceEntityId: "x",
            pluralscapeEntityId: "y",
          },
          auth,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── LOOKUP ──────────────────────────────────────────────────────

  describe("lookupImportEntityRef", () => {
    it("returns the ref for a known source/type/source-id", async () => {
      const created = await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "lookup-me",
          pluralscapeEntityId: "mem_lookup_target",
        },
        auth,
      );

      const result = await lookupImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "lookup-me",
        },
        auth,
      );

      expect(result?.id).toBe(created.id);
      expect(result?.pluralscapeEntityId).toBe("mem_lookup_target");
    });

    it("returns null when no matching ref exists", async () => {
      const result = await lookupImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "nonexistent",
        },
        auth,
      );

      expect(result).toBeNull();
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        lookupImportEntityRef(
          asDb(db),
          otherSystemId,
          {
            source: "simply-plural",
            sourceEntityType: "member",
            sourceEntityId: "x",
          },
          auth,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listImportEntityRefs", () => {
    it("returns all refs for the system", async () => {
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "m1",
          pluralscapeEntityId: "mem_1",
        },
        auth,
      );
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "group",
          sourceEntityId: "g1",
          pluralscapeEntityId: "grp_1",
        },
        auth,
      );

      const result = await listImportEntityRefs(asDb(db), systemId, auth, {});
      expect(result.data.length).toBe(2);
    });

    it("filters by entityType", async () => {
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "m1",
          pluralscapeEntityId: "mem_1",
        },
        auth,
      );
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "group",
          sourceEntityId: "g1",
          pluralscapeEntityId: "grp_1",
        },
        auth,
      );

      const result = await listImportEntityRefs(asDb(db), systemId, auth, {
        entityType: "group",
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.sourceEntityType).toBe("group");
    });

    it("filters by source", async () => {
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "m1",
          pluralscapeEntityId: "mem_1",
        },
        auth,
      );
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "pluralkit",
          sourceEntityType: "member",
          sourceEntityId: "m2",
          pluralscapeEntityId: "mem_2",
        },
        auth,
      );

      const result = await listImportEntityRefs(asDb(db), systemId, auth, {
        source: "pluralkit",
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.source).toBe("pluralkit");
    });

    it("rejects when systemId does not belong to the caller", async () => {
      const otherSystemId = brandId<SystemId>("sys_other");
      await assertApiError(
        listImportEntityRefs(asDb(db), otherSystemId, auth, {}),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── Pagination and limit clamping ─────────────────────────────────

  describe("listImportEntityRefs pagination and limit clamping", () => {
    it("paginates with cursor over 12 refs in pages of 5", async () => {
      for (let i = 0; i < 12; i++) {
        await recordImportEntityRef(
          asDb(db),
          systemId,
          {
            source: "simply-plural",
            sourceEntityType: "member",
            sourceEntityId: `sp-paginate-${String(i)}`,
            pluralscapeEntityId: `mem_paginate_${String(i)}`,
          },
          auth,
        );
      }

      const page1 = await listImportEntityRefs(asDb(db), systemId, auth, { limit: 5 });
      expect(page1.data).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listImportEntityRefs(asDb(db), systemId, auth, {
        limit: 5,
        cursor: page1.nextCursor ?? undefined,
      });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(true);

      const page3 = await listImportEntityRefs(asDb(db), systemId, auth, {
        limit: 5,
        cursor: page2.nextCursor ?? undefined,
      });
      expect(page3.data).toHaveLength(2);
      expect(page3.hasMore).toBe(false);

      // No overlap across pages
      const ids = new Set([
        ...page1.data.map((r) => r.id),
        ...page2.data.map((r) => r.id),
        ...page3.data.map((r) => r.id),
      ]);
      expect(ids.size).toBe(12);
    });

    it("filters by sourceEntityId", async () => {
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "sp-filter-target",
          pluralscapeEntityId: "mem_filter_one",
        },
        auth,
      );
      await recordImportEntityRef(
        asDb(db),
        systemId,
        {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "sp-filter-other",
          pluralscapeEntityId: "mem_filter_two",
        },
        auth,
      );

      const result = await listImportEntityRefs(asDb(db), systemId, auth, {
        sourceEntityId: "sp-filter-target",
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.sourceEntityId).toBe("sp-filter-target");
    });

    it("clamps limit to MAX_PAGE_LIMIT (100)", async () => {
      const result = await listImportEntityRefs(asDb(db), systemId, auth, { limit: 99999 });
      expect(result.data.length).toBeLessThanOrEqual(100);
    });
  });

  // ── Validation ───────────────────────────────────────────────────

  describe("recordImportEntityRef validation", () => {
    const baseInput = {
      source: "simply-plural" as const,
      sourceEntityType: "member" as const,
    };

    it("rejects empty sourceEntityId with VALIDATION_ERROR", async () => {
      await assertApiError(
        recordImportEntityRef(
          asDb(db),
          systemId,
          { ...baseInput, sourceEntityId: "", pluralscapeEntityId: "mem_x" },
          auth,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("rejects empty pluralscapeEntityId with VALIDATION_ERROR", async () => {
      await assertApiError(
        recordImportEntityRef(
          asDb(db),
          systemId,
          { ...baseInput, sourceEntityId: "sp-x", pluralscapeEntityId: "" },
          auth,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });
});
