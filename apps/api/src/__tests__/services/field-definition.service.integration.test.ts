import { PGlite } from "@electric-sql/pglite";
import { serializeEncryptedBlob } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCustomFieldsTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { createId, ID_PREFIXES, now, brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createFieldDefinition } from "../../services/field-definition/create.js";
import { deleteFieldDefinition } from "../../services/field-definition/delete.js";
import { getFieldDefinition } from "../../services/field-definition/get.js";
import { clearFieldDefCache } from "../../services/field-definition/internal.js";
import { listFieldDefinitions } from "../../services/field-definition/list.js";
import { restoreFieldDefinition } from "../../services/field-definition/restore.js";
import { updateFieldDefinition } from "../../services/field-definition/update.js";
import { asDb, assertApiError, makeAuth, noopAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { fieldDefinitions, fieldValues, fieldBucketVisibility, fieldDefinitionScopes, buckets } =
  schema;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a valid base64-encoded EncryptedBlob that passes parseAndValidateFieldBlob. */
function validBlobBase64(): string {
  const blob = testBlob();
  const serialized = serializeEncryptedBlob(blob);
  return Buffer.from(serialized).toString("base64");
}

/** Build a base64 string that is within the size limit but cannot be deserialized as an EncryptedBlob. */
function invalidBlobBase64(): string {
  // 4 bytes — under the 32768 limit but not a valid serialized EncryptedBlob
  return Buffer.from(new Uint8Array([0x00, 0x01, 0x02, 0x03])).toString("base64");
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("field-definition.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCustomFieldsTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    clearFieldDefCache();
    await db.delete(fieldBucketVisibility);
    await db.delete(fieldDefinitionScopes);
    await db.delete(fieldValues);
    await db.delete(fieldDefinitions);
  });

  // ── Helper: insert a field definition directly ──────────────────────

  async function insertFieldDef(archived = false): Promise<FieldDefinitionId> {
    const id = createId(ID_PREFIXES.fieldDefinition);
    const ts = now();
    const archivedAt = archived ? ts : null;
    await db.insert(fieldDefinitions).values({
      id,
      systemId,
      fieldType: "text",
      encryptedData: testBlob(),
      sortOrder: 0,
      required: false,
      archived,
      archivedAt,
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<FieldDefinitionId>(id);
  }

  async function insertBucket(): Promise<string> {
    const id = createId(ID_PREFIXES.bucket);
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return id;
  }

  // ── CREATE ────────────────────────────────────────────────────────────

  describe("createFieldDefinition", () => {
    it("creates a field definition and returns the result", async () => {
      const result = await createFieldDefinition(
        asDb(db),
        systemId,
        { fieldType: "text", encryptedData: validBlobBase64() },
        auth,
        noopAudit,
      );

      expect(result.fieldType).toBe("text");
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
    });

    it("throws VALIDATION_ERROR when encryptedData is not a valid EncryptedBlob", async () => {
      await assertApiError(
        createFieldDefinition(
          asDb(db),
          systemId,
          { fieldType: "text", encryptedData: invalidBlobBase64() },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── LIST ──────────────────────────────────────────────────────────────

  describe("listFieldDefinitions", () => {
    it("returns empty list when no definitions exist", async () => {
      const result = await listFieldDefinitions(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("returns field definitions without cursor", async () => {
      await insertFieldDef();
      await insertFieldDef();

      const result = await listFieldDefinitions(asDb(db), systemId, auth);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it("paginates with cursor — list from cursor onwards (line 244 cursor branch)", async () => {
      const id1 = await insertFieldDef();
      const id2 = await insertFieldDef();

      // First page — no cursor
      const firstPage = await listFieldDefinitions(asDb(db), systemId, auth, { limit: 1 });
      expect(firstPage.data).toHaveLength(1);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).not.toBeNull();

      // Second page — with cursor
      const secondPage = await listFieldDefinitions(asDb(db), systemId, auth, {
        cursor: firstPage.nextCursor ?? undefined,
        limit: 10,
      });
      expect(secondPage.data.length).toBeGreaterThanOrEqual(1);

      // Both IDs are retrievable across pages
      const allIds = [...firstPage.data.map((d) => d.id), ...secondPage.data.map((d) => d.id)];
      expect(allIds).toContain(id1);
      expect(allIds).toContain(id2);
    });

    it("uses cached result on second call with same key", async () => {
      await insertFieldDef();

      const first = await listFieldDefinitions(asDb(db), systemId, auth);
      const second = await listFieldDefinitions(asDb(db), systemId, auth);

      // Results are identical (cache hit)
      expect(first).toStrictEqual(second);
    });

    it("includes archived definitions when includeArchived is true", async () => {
      await insertFieldDef(true); // archived
      await insertFieldDef(false); // active

      const withArchived = await listFieldDefinitions(asDb(db), systemId, auth, {
        includeArchived: true,
      });
      expect(withArchived.data.length).toBeGreaterThanOrEqual(2);

      const withoutArchived = await listFieldDefinitions(asDb(db), systemId, auth);
      expect(withoutArchived.data.length).toBeLessThan(withArchived.data.length);
    });
  });

  // ── GET ───────────────────────────────────────────────────────────────

  describe("getFieldDefinition", () => {
    it("returns field definition by id", async () => {
      const id = await insertFieldDef();
      const result = await getFieldDefinition(asDb(db), systemId, id, auth);
      expect(result.id).toBe(id);
    });

    it("throws NOT_FOUND for unknown id", async () => {
      const fakeId = brandId<FieldDefinitionId>(`fld_${crypto.randomUUID()}`);
      await assertApiError(getFieldDefinition(asDb(db), systemId, fakeId, auth), "NOT_FOUND", 404);
    });
  });

  // ── UPDATE ────────────────────────────────────────────────────────────

  describe("updateFieldDefinition", () => {
    it("updates a field definition", async () => {
      const id = await insertFieldDef();
      const existing = await getFieldDefinition(asDb(db), systemId, id, auth);

      const result = await updateFieldDefinition(
        asDb(db),
        systemId,
        id,
        { encryptedData: validBlobBase64(), version: existing.version },
        auth,
        noopAudit,
      );

      expect(result.id).toBe(id);
      expect(result.version).toBe(existing.version + 1);
    });

    it("throws CONFLICT on version mismatch", async () => {
      const id = await insertFieldDef();

      await assertApiError(
        updateFieldDefinition(
          asDb(db),
          systemId,
          id,
          { encryptedData: validBlobBase64(), version: 999 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("throws NOT_FOUND for unknown field id", async () => {
      const fakeId = brandId<FieldDefinitionId>(`fld_${crypto.randomUUID()}`);
      await assertApiError(
        updateFieldDefinition(
          asDb(db),
          systemId,
          fakeId,
          { encryptedData: validBlobBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws VALIDATION_ERROR on update with invalid blob bytes", async () => {
      const id = await insertFieldDef();

      await assertApiError(
        updateFieldDefinition(
          asDb(db),
          systemId,
          id,
          { encryptedData: invalidBlobBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── ARCHIVE / RESTORE ─────────────────────────────────────────────────

  describe("restoreFieldDefinition", () => {
    it("restores an archived field definition", async () => {
      const id = await insertFieldDef(true);

      const result = await restoreFieldDefinition(asDb(db), systemId, id, auth, noopAudit);

      expect(result.id).toBe(id);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
    });

    it("throws NOT_FOUND when trying to restore a non-archived definition", async () => {
      const id = await insertFieldDef(false);
      const fakeArchivedId = id;
      // The service looks for archived=true; active definitions are "not found"
      await assertApiError(
        restoreFieldDefinition(asDb(db), systemId, fakeArchivedId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── DELETE ────────────────────────────────────────────────────────────

  describe("deleteFieldDefinition", () => {
    it("deletes a field definition with no dependents", async () => {
      const id = await insertFieldDef();

      await deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit);

      await assertApiError(getFieldDefinition(asDb(db), systemId, id, auth), "NOT_FOUND", 404);
    });

    it("throws HAS_DEPENDENTS when field values exist", async () => {
      const id = await insertFieldDef();
      const ts = now();
      await db.insert(fieldValues).values({
        id: createId(ID_PREFIXES.fieldValue),
        fieldDefinitionId: id,
        systemId,
        encryptedData: testBlob(),
        createdAt: ts,
        updatedAt: ts,
      });

      await assertApiError(
        deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("throws HAS_DEPENDENTS when bucket visibility rows exist", async () => {
      const id = await insertFieldDef();
      const bucketId = await insertBucket();
      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: id,
        bucketId,
        systemId,
      });

      await assertApiError(
        deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("throws HAS_DEPENDENTS when scope rows exist", async () => {
      const id = await insertFieldDef();
      const ts = now();
      await db.insert(fieldDefinitionScopes).values({
        id: createId(ID_PREFIXES.fieldDefinitionScope),
        fieldDefinitionId: id,
        systemId,
        scopeType: "member",
        createdAt: ts,
        updatedAt: ts,
      });

      await assertApiError(
        deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("force-deletes field definition with field values", async () => {
      const id = await insertFieldDef();
      const ts = now();
      await db.insert(fieldValues).values({
        id: createId(ID_PREFIXES.fieldValue),
        fieldDefinitionId: id,
        systemId,
        encryptedData: testBlob(),
        createdAt: ts,
        updatedAt: ts,
      });

      await deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit, { force: true });

      await assertApiError(getFieldDefinition(asDb(db), systemId, id, auth), "NOT_FOUND", 404);
    });

    it("force-deletes field definition with bucket visibility dependents", async () => {
      const id = await insertFieldDef();
      const bucketId = await insertBucket();
      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: id,
        bucketId,
        systemId,
      });

      await deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit, { force: true });

      await assertApiError(getFieldDefinition(asDb(db), systemId, id, auth), "NOT_FOUND", 404);
    });

    it("force-deletes field definition with scope dependents", async () => {
      const id = await insertFieldDef();
      const ts = now();
      await db.insert(fieldDefinitionScopes).values({
        id: createId(ID_PREFIXES.fieldDefinitionScope),
        fieldDefinitionId: id,
        systemId,
        scopeType: "member",
        createdAt: ts,
        updatedAt: ts,
      });

      await deleteFieldDefinition(asDb(db), systemId, id, auth, noopAudit, { force: true });

      await assertApiError(getFieldDefinition(asDb(db), systemId, id, auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND for unknown field id", async () => {
      const fakeId = brandId<FieldDefinitionId>(`fld_${crypto.randomUUID()}`);
      await assertApiError(
        deleteFieldDefinition(asDb(db), systemId, fakeId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
