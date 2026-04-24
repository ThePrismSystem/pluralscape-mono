import { buckets, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { CreateBucketBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_BUCKETS_PER_SYSTEM } from "../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBucketResult } from "./internal.js";

import type { BucketResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  assertSystemOwnership(systemId, auth);

  const { blob } = parseAndValidateBlob(params, CreateBucketBodySchema, MAX_ENCRYPTED_DATA_BYTES);

  const bucketId = brandId<BucketId>(createId(ID_PREFIXES.bucket));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock the system row to serialize concurrent bucket creation per system (prevents TOCTOU race)
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(buckets)
      .where(and(eq(buckets.systemId, systemId), eq(buckets.archived, false)));

    if ((existing?.count ?? 0) >= MAX_BUCKETS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_BUCKETS_PER_SYSTEM)} buckets per system`,
      );
    }

    const [row] = await tx
      .insert(buckets)
      .values({
        id: bucketId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create bucket — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "bucket.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Bucket created",
      systemId,
    });
    const result = toBucketResult(row);
    await dispatchWebhookEvent(tx, systemId, "bucket.created", {
      bucketId: result.id,
    });

    return result;
  });
}
