import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCustomFieldsTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { createId, ID_PREFIXES, now } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  listFieldBucketVisibility,
  removeFieldBucketVisibility,
  setFieldBucketVisibility,
} from "../../services/field-bucket-visibility.service.js";
import {
  asDb,
  assertApiError,
  genBucketId,
  makeAuth,
  noopAudit,
  spyAudit,
  testBlob,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, BucketId, FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { fieldBucketVisibility, fieldDefinitions, buckets } = schema;

function genFieldDefinitionId(): FieldDefinitionId {
  return `fld_${crypto.randomUUID()}` as FieldDefinitionId;
}

describe("field-bucket-visibility.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgCustomFieldsTables(client);

    // Webhook tables required by dispatchWebhookEvent
    await pgExec(client, PG_DDL.apiKeys);
    await pgExec(client, PG_DDL.apiKeysIndexes);
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(fieldBucketVisibility);
    await db.delete(fieldDefinitions);
    await db.delete(buckets);
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  async function insertBucket(): Promise<BucketId> {
    const id = createId(ID_PREFIXES.bucket);
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return id as BucketId;
  }

  async function insertFieldDefinition(): Promise<FieldDefinitionId> {
    const id = createId(ID_PREFIXES.fieldDefinition);
    const ts = now();
    await db.insert(fieldDefinitions).values({
      id,
      systemId,
      fieldType: "text",
      encryptedData: testBlob(),
      sortOrder: 0,
      required: false,
      createdAt: ts,
      updatedAt: ts,
    });
    return id as FieldDefinitionId;
  }

  // ── setFieldBucketVisibility ─────────────────────────────────────────

  describe("setFieldBucketVisibility", () => {
    it("sets visibility and returns expected shape", async () => {
      const bucketId = await insertBucket();
      const fieldId = await insertFieldDefinition();
      const audit = spyAudit();

      const result = await setFieldBucketVisibility(
        asDb(db),
        systemId,
        fieldId,
        bucketId,
        auth,
        audit,
      );

      expect(result.fieldDefinitionId).toBe(fieldId);
      expect(result.bucketId).toBe(bucketId);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("field-bucket-visibility.set");
    });

    it("returns NOT_FOUND when field definition does not exist", async () => {
      const bucketId = await insertBucket();

      await assertApiError(
        setFieldBucketVisibility(
          asDb(db),
          systemId,
          genFieldDefinitionId(),
          bucketId,
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND when bucket does not exist", async () => {
      const fieldId = await insertFieldDefinition();

      await assertApiError(
        setFieldBucketVisibility(asDb(db), systemId, fieldId, genBucketId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("is idempotent — no duplicate audit on second call", async () => {
      const bucketId = await insertBucket();
      const fieldId = await insertFieldDefinition();

      const firstAudit = spyAudit();
      await setFieldBucketVisibility(asDb(db), systemId, fieldId, bucketId, auth, firstAudit);
      expect(firstAudit.calls).toHaveLength(1);

      const secondAudit = spyAudit();
      await setFieldBucketVisibility(asDb(db), systemId, fieldId, bucketId, auth, secondAudit);
      expect(secondAudit.calls).toHaveLength(0);
    });
  });

  // ── removeFieldBucketVisibility ──────────────────────────────────────

  describe("removeFieldBucketVisibility", () => {
    it("removes visibility", async () => {
      const bucketId = await insertBucket();
      const fieldId = await insertFieldDefinition();

      await setFieldBucketVisibility(asDb(db), systemId, fieldId, bucketId, auth, noopAudit);

      const audit = spyAudit();
      await removeFieldBucketVisibility(asDb(db), systemId, fieldId, bucketId, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("field-bucket-visibility.removed");
    });

    it("returns NOT_FOUND when visibility does not exist", async () => {
      const bucketId = await insertBucket();
      const fieldId = await insertFieldDefinition();

      await assertApiError(
        removeFieldBucketVisibility(asDb(db), systemId, fieldId, bucketId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── listFieldBucketVisibility ────────────────────────────────────────

  describe("listFieldBucketVisibility", () => {
    it("returns all entries for a field", async () => {
      const fieldId = await insertFieldDefinition();
      const bucketA = await insertBucket();
      const bucketB = await insertBucket();

      await setFieldBucketVisibility(asDb(db), systemId, fieldId, bucketA, auth, noopAudit);
      await setFieldBucketVisibility(asDb(db), systemId, fieldId, bucketB, auth, noopAudit);

      const result = await listFieldBucketVisibility(asDb(db), systemId, fieldId, auth);

      expect(result).toHaveLength(2);
    });

    it("returns empty list when none exist", async () => {
      const fieldId = await insertFieldDefinition();

      const result = await listFieldBucketVisibility(asDb(db), systemId, fieldId, auth);

      expect(result).toHaveLength(0);
    });
  });
});
