import { buckets } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateBucketBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBucketResult } from "./internal.js";

import type { BucketResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateBucketBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(buckets)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${buckets.version} + 1`,
      })
      .where(
        and(
          eq(buckets.id, bucketId),
          eq(buckets.systemId, systemId),
          eq(buckets.version, version),
          eq(buckets.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: buckets.id })
          .from(buckets)
          .where(and(eq(buckets.id, bucketId), eq(buckets.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Bucket",
    );

    await audit(tx, {
      eventType: "bucket.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Bucket updated",
      systemId,
    });
    const result = toBucketResult(row);
    await dispatchWebhookEvent(tx, systemId, "bucket.updated", {
      bucketId: result.id,
    });

    return result;
  });
}
