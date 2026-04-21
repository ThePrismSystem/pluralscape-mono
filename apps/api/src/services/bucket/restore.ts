import { buckets } from "@pluralscape/db/pg";

import { restoreEntity } from "../../lib/entity-lifecycle.js";

import { BUCKET_LIFECYCLE, toBucketResult } from "./internal.js";

import type { BucketResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function restoreBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  return restoreEntity(db, systemId, bucketId, auth, audit, BUCKET_LIFECYCLE, (row) =>
    toBucketResult(row as typeof buckets.$inferSelect),
  );
}
