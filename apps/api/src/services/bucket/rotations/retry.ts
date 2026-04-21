import { bucketKeyRotations, bucketRotationItems } from "@pluralscape/db/pg";
import { ROTATION_ITEM_STATUSES, ROTATION_STATES } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toRotationResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  BucketId,
  BucketKeyRotation,
  BucketKeyRotationId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Resets failed rotation items back to pending so the client can re-attempt
 * them. Only valid when the rotation is in "failed" state.
 */
export async function retryRotation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  rotationId: BucketKeyRotationId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketKeyRotation> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock rotation row to serialize concurrent retries
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
      .for("update")
      .limit(1);

    if (!rotation) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Rotation not found");
    }

    if (rotation.state !== ROTATION_STATES.failed) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Rotation is in state "${rotation.state}" — only failed rotations can be retried`,
      );
    }

    // Reset all failed items to pending and clear their claim
    const resetResult = await tx
      .update(bucketRotationItems)
      .set({
        status: ROTATION_ITEM_STATUSES.pending,
        claimedBy: null,
        claimedAt: null,
      })
      .where(
        and(
          eq(bucketRotationItems.rotationId, rotationId),
          eq(bucketRotationItems.status, ROTATION_ITEM_STATUSES.failed),
        ),
      )
      .returning({ id: bucketRotationItems.id });

    // Transition rotation back to migrating and reset failedItems counter
    const [updated] = await tx
      .update(bucketKeyRotations)
      .set({
        state: ROTATION_STATES.migrating,
        failedItems: 0,
      })
      .where(eq(bucketKeyRotations.id, rotationId))
      .returning();

    if (!updated) {
      throw new Error("Rotation record disappeared during retry transaction");
    }

    await audit(tx, {
      eventType: "bucket.key_rotation.retried",
      actor: { kind: "account", id: auth.accountId },
      detail: `Rotation retried: ${String(resetResult.length)} failed items reset to pending`,
      systemId,
    });

    return toRotationResult(updated);
  });
}
