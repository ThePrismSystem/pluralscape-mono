import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgStructureTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveRelationship,
  createRelationship,
  deleteRelationship,
  getRelationship,
  listRelationships,
  restoreRelationship,
  updateRelationship,
} from "../../services/relationship.service.js";
import {
  asDb,
  assertApiError,
  genAccountId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, MemberId, RelationshipId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { relationships } = schema;

describe("relationship.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;
  let memberA: MemberId;
  let memberB: MemberId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgStructureTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
    memberA = (await pgInsertMember(db, systemId)) as MemberId;
    memberB = (await pgInsertMember(db, systemId)) as MemberId;
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(relationships);
  });

  function relParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      sourceMemberId: memberA,
      targetMemberId: memberB,
      type: "sibling",
      bidirectional: true,
      encryptedData: testEncryptedDataBase64(),
      ...overrides,
    };
  }

  // ── createRelationship ──────────────────────────────────────────────

  describe("createRelationship", () => {
    it("creates a relationship between two members", async () => {
      const audit = spyAudit();
      const result = await createRelationship(asDb(db), systemId, relParams(), auth, audit);

      expect(result.id).toMatch(/^rel_/);
      expect(result.systemId).toBe(systemId);
      expect(result.sourceMemberId).toBe(memberA);
      expect(result.targetMemberId).toBe(memberB);
      expect(result.type).toBe("sibling");
      expect(result.bidirectional).toBe(true);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("relationship.created");
    });

    it("rejects when source member does not exist", async () => {
      await assertApiError(
        createRelationship(
          asDb(db),
          systemId,
          relParams({ sourceMemberId: `mem_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
        "Source member not found",
      );
    });

    it("rejects when target member does not exist", async () => {
      await assertApiError(
        createRelationship(
          asDb(db),
          systemId,
          relParams({ targetMemberId: `mem_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
        "Target member not found",
      );
    });

    it("rejects cross-system access", async () => {
      const otherAccountId = genAccountId();
      const otherSystemId = `sys_${crypto.randomUUID()}` as SystemId;
      const otherAuth = makeAuth(otherAccountId, otherSystemId);

      await assertApiError(
        createRelationship(asDb(db), systemId, relParams(), otherAuth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── getRelationship ──────────────────────────────────────────────────

  describe("getRelationship", () => {
    it("returns a relationship by id", async () => {
      const created = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);

      const fetched = await getRelationship(asDb(db), systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
      expect(fetched.sourceMemberId).toBe(memberA);
      expect(fetched.targetMemberId).toBe(memberB);
    });

    it("throws NOT_FOUND for nonexistent id", async () => {
      await assertApiError(
        getRelationship(asDb(db), systemId, `rel_${crypto.randomUUID()}` as RelationshipId, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── listRelationships ────────────────────────────────────────────────

  describe("listRelationships", () => {
    it("lists all relationships for a system", async () => {
      await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);
      await createRelationship(
        asDb(db),
        systemId,
        relParams({ type: "partner", bidirectional: false }),
        auth,
        noopAudit,
      );

      const result = await listRelationships(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);
    });

    it("filters by memberId (source or target)", async () => {
      const memberC = (await pgInsertMember(db, systemId)) as MemberId;
      await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);
      await createRelationship(
        asDb(db),
        systemId,
        relParams({ sourceMemberId: memberA, targetMemberId: memberC }),
        auth,
        noopAudit,
      );

      const result = await listRelationships(
        asDb(db),
        systemId,
        auth,
        undefined,
        undefined,
        memberC,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.targetMemberId).toBe(memberC);
    });

    it("filters by type", async () => {
      await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);
      await createRelationship(asDb(db), systemId, relParams({ type: "partner" }), auth, noopAudit);

      const result = await listRelationships(
        asDb(db),
        systemId,
        auth,
        undefined,
        undefined,
        undefined,
        "partner",
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.type).toBe("partner");
    });

    it("excludes archived relationships", async () => {
      const rel = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);
      await archiveRelationship(asDb(db), systemId, rel.id, auth, noopAudit);

      const result = await listRelationships(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── updateRelationship ───────────────────────────────────────────────

  describe("updateRelationship", () => {
    it("updates type and bidirectional flag", async () => {
      const created = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);

      const audit = spyAudit();
      const updated = await updateRelationship(
        asDb(db),
        systemId,
        created.id,
        {
          type: "partner",
          bidirectional: false,
          encryptedData: testEncryptedDataBase64(),
          version: 1,
        },
        auth,
        audit,
      );

      expect(updated.type).toBe("partner");
      expect(updated.bidirectional).toBe(false);
      expect(updated.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("relationship.updated");
    });

    it("rejects stale version (OCC)", async () => {
      const created = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);

      await assertApiError(
        updateRelationship(
          asDb(db),
          systemId,
          created.id,
          {
            type: "partner",
            bidirectional: false,
            encryptedData: testEncryptedDataBase64(),
            version: 99,
          },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  // ── deleteRelationship ───────────────────────────────────────────────

  describe("deleteRelationship", () => {
    it("hard-deletes a relationship", async () => {
      const created = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);
      const audit = spyAudit();
      await deleteRelationship(asDb(db), systemId, created.id, auth, audit);

      await assertApiError(getRelationship(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("relationship.deleted");
    });

    it("throws NOT_FOUND for nonexistent relationship", async () => {
      await assertApiError(
        deleteRelationship(
          asDb(db),
          systemId,
          `rel_${crypto.randomUUID()}` as RelationshipId,
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── archive / restore ────────────────────────────────────────────────

  describe("archive / restore", () => {
    it("archives and then restores a relationship", async () => {
      const created = await createRelationship(asDb(db), systemId, relParams(), auth, noopAudit);

      await archiveRelationship(asDb(db), systemId, created.id, auth, noopAudit);

      // Archived relationship is not visible via get
      await assertApiError(getRelationship(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);

      const restored = await restoreRelationship(asDb(db), systemId, created.id, auth, noopAudit);
      expect(restored.id).toBe(created.id);
      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
    });
  });
});
