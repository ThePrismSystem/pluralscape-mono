import { bucketContentTags, bucketKeyRotations, bucketRotationItems } from "@pluralscape/db/pg";
import {
  ID_PREFIXES,
  KEY_ROTATION,
  ROTATION_ITEM_STATUSES,
  ROTATION_STATES,
  createId,
  now,
} from "@pluralscape/types";
import { CompleteChunkBodySchema } from "@pluralscape/validation";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toRotationResult } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  BucketId,
  BucketKeyRotationId,
  ChunkCompletionResponse,
  RotationItemStatus,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function completeRotationChunk(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  rotationId: BucketKeyRotationId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChunkCompletionResponse> {
  assertSystemOwnership(systemId, auth);

  const parsed = CompleteChunkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid completion payload");
  }

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock the rotation record to prevent concurrent sealing transitions
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

    if (rotation.state !== ROTATION_STATES.migrating) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Rotation is in state "${rotation.state}" — cannot complete chunks`,
      );
    }

    const timestamp = now();
    let completedDelta = 0;
    let failedDelta = 0;

    // Batch update items by outcome to avoid N individual round-trips
    const completedIds = parsed.data.items
      .filter((item) => item.status === ROTATION_ITEM_STATUSES.completed)
      .map((item) => item.itemId);

    const pendingIds = parsed.data.items
      .filter((item) => item.status !== ROTATION_ITEM_STATUSES.completed)
      .map((item) => item.itemId);

    if (completedIds.length > 0) {
      await tx
        .update(bucketRotationItems)
        .set({ status: ROTATION_ITEM_STATUSES.completed, completedAt: timestamp })
        .where(inArray(bucketRotationItems.id, completedIds));
      completedDelta = completedIds.length;
    }

    if (pendingIds.length > 0) {
      // Increment attempts; mark permanently failed if max exceeded
      const updated = await tx
        .update(bucketRotationItems)
        .set({
          status: sql<RotationItemStatus>`CASE WHEN ${bucketRotationItems.attempts} + 1 >= ${KEY_ROTATION.maxItemAttempts} THEN 'failed' ELSE 'pending' END`,
          attempts: sql`${bucketRotationItems.attempts} + 1`,
          claimedBy: null,
          claimedAt: null,
        })
        .where(inArray(bucketRotationItems.id, pendingIds))
        .returning();
      failedDelta = updated.filter((r) => r.status === ROTATION_ITEM_STATUSES.failed).length;
    }

    // Update rotation counters
    const newCompleted = rotation.completedItems + completedDelta;
    const newFailed = rotation.failedItems + failedDelta;
    let transitioned = false;

    if (newCompleted + newFailed >= rotation.totalItems) {
      // Enter sealing phase: check for items added after initiation
      const newContentTags = await tx
        .select()
        .from(bucketContentTags)
        .where(
          and(eq(bucketContentTags.bucketId, bucketId), eq(bucketContentTags.systemId, systemId)),
        )
        .for("update");

      // Find items that aren't in the rotation set
      const existingItemKeys = new Set(
        (
          await tx
            .select({
              entityType: bucketRotationItems.entityType,
              entityId: bucketRotationItems.entityId,
            })
            .from(bucketRotationItems)
            .where(eq(bucketRotationItems.rotationId, rotationId))
        ).map((r) => `${r.entityType}:${r.entityId}`),
      );

      const newItems = newContentTags.filter(
        (tag) => !existingItemKeys.has(`${tag.entityType}:${tag.entityId}`),
      );

      if (newItems.length > 0) {
        // Add new items and stay in migrating
        await tx.insert(bucketRotationItems).values(
          newItems.map((tag) => ({
            id: createId(ID_PREFIXES.bucketRotationItem),
            rotationId,
            systemId,
            entityType: tag.entityType,
            entityId: tag.entityId,
            status: ROTATION_ITEM_STATUSES.pending as RotationItemStatus,
            attempts: 0,
          })),
        );
        // Update totalItems
        const updatedTotal = rotation.totalItems + newItems.length;
        await tx
          .update(bucketKeyRotations)
          .set({
            completedItems: newCompleted,
            failedItems: newFailed,
            totalItems: updatedTotal,
          })
          .where(eq(bucketKeyRotations.id, rotationId));

        // Stay in migrating state
      } else if (newFailed > 0) {
        transitioned = true;
        await tx
          .update(bucketKeyRotations)
          .set({
            state: ROTATION_STATES.failed,
            completedItems: newCompleted,
            failedItems: newFailed,
          })
          .where(eq(bucketKeyRotations.id, rotationId));

        await audit(tx, {
          eventType: "bucket.key_rotation.failed",
          actor: { kind: "account", id: auth.accountId },
          detail: `Rotation failed: ${String(newFailed)} items could not be re-encrypted`,
          systemId,
        });
      } else {
        transitioned = true;
        await tx
          .update(bucketKeyRotations)
          .set({
            state: ROTATION_STATES.completed,
            completedItems: newCompleted,
            failedItems: newFailed,
            completedAt: timestamp,
          })
          .where(eq(bucketKeyRotations.id, rotationId));

        await audit(tx, {
          eventType: "bucket.key_rotation.completed",
          actor: { kind: "account", id: auth.accountId },
          detail: `Rotation completed: ${String(newCompleted)} items re-encrypted`,
          systemId,
        });
      }
    } else {
      // Not done yet, just update counters
      await tx
        .update(bucketKeyRotations)
        .set({
          completedItems: newCompleted,
          failedItems: newFailed,
        })
        .where(eq(bucketKeyRotations.id, rotationId));
    }

    await audit(tx, {
      eventType: "bucket.key_rotation.chunk_completed",
      actor: { kind: "account", id: auth.accountId },
      detail: `Chunk completed: ${String(completedDelta)} succeeded, ${String(failedDelta)} failed`,
      systemId,
    });

    // Fetch final state
    const [finalRotation] = await tx
      .select()
      .from(bucketKeyRotations)
      .where(eq(bucketKeyRotations.id, rotationId))
      .limit(1);

    if (!finalRotation) {
      throw new Error("Rotation record disappeared during transaction");
    }

    return {
      rotation: toRotationResult(finalRotation),
      transitioned,
    };
  });
}
