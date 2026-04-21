import { bucketKeyRotations, bucketRotationItems } from "@pluralscape/db/pg";
import {
  brandId,
  KEY_ROTATION,
  ROTATION_ITEM_STATUSES,
  ROTATION_STATES,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { ClaimChunkBodySchema } from "@pluralscape/validation";
import { and, eq, inArray, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  BucketId,
  BucketKeyRotationId,
  BucketRotationItem,
  ChunkClaimResponse,
  RotationState,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

function toItemResult(row: typeof bucketRotationItems.$inferSelect): BucketRotationItem {
  return {
    id: row.id as BucketRotationItem["id"],
    rotationId: brandId<BucketKeyRotationId>(row.rotationId),
    entityType: row.entityType,
    entityId: row.entityId,
    status: row.status,
    claimedBy: row.claimedBy,
    claimedAt: toUnixMillisOrNull(row.claimedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
    attempts: row.attempts,
  };
}

export async function claimRotationChunk(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  rotationId: BucketKeyRotationId,
  params: unknown,
  auth: AuthContext,
): Promise<ChunkClaimResponse> {
  assertSystemOwnership(systemId, auth);

  const parsed = ClaimChunkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid claim payload");
  }

  const chunkSize = parsed.data.chunkSize;

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify rotation exists and belongs to this system/bucket
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

    if (
      rotation.state !== ROTATION_STATES.initiated &&
      rotation.state !== ROTATION_STATES.migrating
    ) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Rotation is in state "${rotation.state}" — cannot claim chunks`,
      );
    }

    const timestamp = now();
    const staleThreshold = toUnixMillis(timestamp - KEY_ROTATION.staleClaimTimeoutMs);

    // Reclaim stale items
    await tx
      .update(bucketRotationItems)
      .set({ status: ROTATION_ITEM_STATUSES.pending, claimedBy: null, claimedAt: null })
      .where(
        and(
          eq(bucketRotationItems.rotationId, rotationId),
          eq(bucketRotationItems.status, ROTATION_ITEM_STATUSES.claimed),
          lt(bucketRotationItems.claimedAt, staleThreshold),
        ),
      );

    // Select pending items
    const pendingItems = await tx
      .select({ id: bucketRotationItems.id })
      .from(bucketRotationItems)
      .where(
        and(
          eq(bucketRotationItems.rotationId, rotationId),
          eq(bucketRotationItems.status, ROTATION_ITEM_STATUSES.pending),
        ),
      )
      .limit(chunkSize);

    if (pendingItems.length === 0) {
      return {
        data: [],
        rotationState: rotation.state as RotationState,
      };
    }

    const pendingIds = pendingItems.map((item) => item.id);

    // CAS claim
    const claimedRows = await tx
      .update(bucketRotationItems)
      .set({
        status: ROTATION_ITEM_STATUSES.claimed,
        claimedBy: auth.authMethod === "session" ? auth.sessionId : auth.keyId,
        claimedAt: timestamp,
      })
      .where(
        and(
          inArray(bucketRotationItems.id, pendingIds),
          eq(bucketRotationItems.status, ROTATION_ITEM_STATUSES.pending),
        ),
      )
      .returning();

    // Transition initiated → migrating on first claim
    let currentState = rotation.state as RotationState;
    if (currentState === ROTATION_STATES.initiated && claimedRows.length > 0) {
      await tx
        .update(bucketKeyRotations)
        .set({ state: ROTATION_STATES.migrating })
        .where(
          and(
            eq(bucketKeyRotations.id, rotationId),
            eq(bucketKeyRotations.state, ROTATION_STATES.initiated),
          ),
        );
      currentState = ROTATION_STATES.migrating;
    }

    return {
      data: claimedRows.map(toItemResult),
      rotationState: currentState,
    };
  });
}
