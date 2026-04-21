import { buckets } from "@pluralscape/db/pg";
import { sql } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { deleteEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

async function checkBucketDependents(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
): Promise<void> {
  const result = await tx.execute<{ type: string; count: number }>(sql`
    SELECT 'bucketContentTags' AS type, COUNT(*)::int AS count
      FROM bucket_content_tags WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'keyGrants', COUNT(*)::int
      FROM key_grants WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'friendBucketAssignments', COUNT(*)::int
      FROM friend_bucket_assignments WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'fieldBucketVisibility', COUNT(*)::int
      FROM field_bucket_visibility WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'bucketKeyRotations', COUNT(*)::int
      FROM bucket_key_rotations WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
  `);

  const rows = Array.isArray(result)
    ? result
    : (result as { rows: { type: string; count: number }[] }).rows;
  const dependents = rows.filter((r) => r.count > 0).map((r) => ({ type: r.type, count: r.count }));

  if (dependents.length > 0) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "HAS_DEPENDENTS",
      "Bucket has dependents. Remove all dependents before deleting.",
      { dependents },
    );
  }
}

const BUCKET_DELETE: DeletableEntityConfig<BucketId> = {
  table: buckets,
  columns: buckets,
  entityName: "Bucket",
  deleteEvent: "bucket.deleted",
  onDelete: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.deleted", { bucketId: eid }),
  checkDependents: checkBucketDependents,
};

export async function deleteBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, bucketId, auth, audit, BUCKET_DELETE);
}
