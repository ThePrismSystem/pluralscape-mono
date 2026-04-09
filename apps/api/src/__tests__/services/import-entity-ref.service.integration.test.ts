import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgImportExportTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  listImportEntityRefs,
  lookupImportEntityRef,
  recordImportEntityRef,
} from "../../services/import-entity-ref.service.js";
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

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
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
      const otherSystemId = "sys_other" as SystemId;
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
      const otherSystemId = "sys_other" as SystemId;
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
      const otherSystemId = "sys_other" as SystemId;
      await assertApiError(
        listImportEntityRefs(asDb(db), otherSystemId, auth, {}),
        "NOT_FOUND",
        404,
      );
    });
  });
});
