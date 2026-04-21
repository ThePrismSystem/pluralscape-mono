import { bucketKeyRotations } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toRotationResult } from "./internal.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  BucketId,
  BucketKeyRotation,
  BucketKeyRotationId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function getRotationProgress(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  rotationId: BucketKeyRotationId,
  auth: AuthContext,
): Promise<BucketKeyRotation> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [rotation] = await tx
      .select()
      .from(bucketKeyRotations)
      .where(
        and(
          eq(bucketKeyRotations.id, rotationId),
          eq(bucketKeyRotations.bucketId, bucketId),
          eq(bucketKeyRotations.systemId, systemId),
        ),
      )
      .limit(1);

    if (!rotation) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Rotation not found");
    }

    return toRotationResult(rotation);
  });
}
