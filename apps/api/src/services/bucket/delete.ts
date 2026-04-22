import {
  bucketContentTags,
  bucketKeyRotations,
  buckets,
  fieldBucketVisibility,
  friendBucketAssignments,
  keyGrants,
} from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
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
  const { dependents } = await checkDependents(tx, [
    {
      table: bucketContentTags,
      predicate: and(
        eq(bucketContentTags.bucketId, bucketId),
        eq(bucketContentTags.systemId, systemId),
      ),
      typeName: "bucketContentTags",
    },
    {
      table: keyGrants,
      predicate: and(eq(keyGrants.bucketId, bucketId), eq(keyGrants.systemId, systemId)),
      typeName: "keyGrants",
    },
    {
      table: friendBucketAssignments,
      predicate: and(
        eq(friendBucketAssignments.bucketId, bucketId),
        eq(friendBucketAssignments.systemId, systemId),
      ),
      typeName: "friendBucketAssignments",
    },
    {
      table: fieldBucketVisibility,
      predicate: and(
        eq(fieldBucketVisibility.bucketId, bucketId),
        eq(fieldBucketVisibility.systemId, systemId),
      ),
      typeName: "fieldBucketVisibility",
    },
    {
      table: bucketKeyRotations,
      predicate: and(
        eq(bucketKeyRotations.bucketId, bucketId),
        eq(bucketKeyRotations.systemId, systemId),
      ),
      typeName: "bucketKeyRotations",
    },
  ]);

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
