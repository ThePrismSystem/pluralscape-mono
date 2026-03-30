import {
  bucketContentTags,
  bucketKeyRotations,
  bucketRotationItems,
  keyGrants,
} from "@pluralscape/db/pg";
import {
  ID_PREFIXES,
  KEY_ROTATION,
  ROTATION_ITEM_STATUSES,
  ROTATION_STATES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  ClaimChunkBodySchema,
  CompleteChunkBodySchema,
  InitiateRotationBodySchema,
} from "@pluralscape/validation";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketId,
  BucketKeyRotation,
  BucketKeyRotationId,
  BucketRotationItem,
  ChunkClaimResponse,
  ChunkCompletionResponse,
  RotationItemStatus,
  RotationState,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Helpers ─────────────────────────────────────────────────────────

function toRotationResult(row: typeof bucketKeyRotations.$inferSelect): BucketKeyRotation {
  return {
    id: row.id as BucketKeyRotationId,
    bucketId: row.bucketId as BucketId,
    fromKeyVersion: row.fromKeyVersion,
    toKeyVersion: row.toKeyVersion,
    state: row.state,
    initiatedAt: toUnixMillis(row.initiatedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
    totalItems: row.totalItems,
    completedItems: row.completedItems,
    failedItems: row.failedItems,
  };
}

function toItemResult(row: typeof bucketRotationItems.$inferSelect): BucketRotationItem {
  return {
    id: row.id as BucketRotationItem["id"],
    rotationId: row.rotationId as BucketKeyRotationId,
    entityType: row.entityType,
    entityId: row.entityId,
    status: row.status,
    claimedBy: row.claimedBy,
    claimedAt: toUnixMillisOrNull(row.claimedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
    attempts: row.attempts,
  };
}

// ── INITIATE ────────────────────────────────────────────────────────

export async function initiateRotation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketKeyRotation> {
  assertSystemOwnership(systemId, auth);

  const parsed = InitiateRotationBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid initiate payload");
  }

  const rotationId = createId(ID_PREFIXES.bucketKeyRotation);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Check for active rotation on this bucket (inside transaction to prevent TOCTOU)
    const [activeRotation] = await tx
      .select()
      .from(bucketKeyRotations)
      .where(
        and(
          eq(bucketKeyRotations.bucketId, bucketId),
          eq(bucketKeyRotations.systemId, systemId),
          inArray(bucketKeyRotations.state, [
            ROTATION_STATES.initiated,
            ROTATION_STATES.migrating,
            ROTATION_STATES.sealing,
          ]),
        ),
      )
      .limit(1);

    if (activeRotation) {
      if (activeRotation.state === ROTATION_STATES.initiated) {
        // Cancel the unclaimed rotation and proceed
        await tx
          .update(bucketKeyRotations)
          .set({ state: ROTATION_STATES.failed })
          .where(eq(bucketKeyRotations.id, activeRotation.id));
      } else {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ROTATION_IN_PROGRESS",
          "A rotation is already in progress for this bucket",
        );
      }
    }

    // Get all content tags for this bucket
    const tags = await tx
      .select()
      .from(bucketContentTags)
      .where(
        and(eq(bucketContentTags.bucketId, bucketId), eq(bucketContentTags.systemId, systemId)),
      );

    // Insert rotation record
    const [rotation] = await tx
      .insert(bucketKeyRotations)
      .values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: parsed.data.newKeyVersion - 1,
        toKeyVersion: parsed.data.newKeyVersion,
        state: ROTATION_STATES.initiated,
        initiatedAt: timestamp,
        totalItems: tags.length,
        completedItems: 0,
        failedItems: 0,
      })
      .returning();

    if (!rotation) {
      throw new Error("Failed to create rotation — INSERT returned no rows");
    }

    // Bulk-insert rotation items for each content tag
    if (tags.length > 0) {
      await tx.insert(bucketRotationItems).values(
        tags.map((tag) => ({
          id: createId(ID_PREFIXES.bucketRotationItem),
          rotationId,
          systemId,
          entityType: tag.entityType,
          entityId: tag.entityId,
          status: ROTATION_ITEM_STATUSES.pending as RotationItemStatus,
          attempts: 0,
        })),
      );
    }

    // Revoke old key grants and insert new ones
    await tx
      .update(keyGrants)
      .set({ revokedAt: timestamp })
      .where(
        and(
          eq(keyGrants.bucketId, bucketId),
          eq(keyGrants.systemId, systemId),
          sql`${keyGrants.revokedAt} IS NULL`,
        ),
      );

    if (parsed.data.friendKeyGrants.length > 0) {
      await tx.insert(keyGrants).values(
        parsed.data.friendKeyGrants.map((grant) => ({
          id: createId(ID_PREFIXES.keyGrant),
          bucketId,
          systemId,
          friendAccountId: grant.friendAccountId,
          encryptedKey: Buffer.from(grant.encryptedKey, "base64"),
          keyVersion: parsed.data.newKeyVersion,
          createdAt: timestamp,
        })),
      );
    }

    await audit(tx, {
      eventType: "bucket.key_rotation.initiated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Rotation initiated for bucket ${bucketId} (v${String(rotation.fromKeyVersion)} → v${String(rotation.toKeyVersion)}, ${String(tags.length)} items)`,
      systemId,
    });

    return toRotationResult(rotation);
  });
}

// ── CLAIM CHUNK ─────────────────────────────────────────────────────

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
        items: [],
        rotationState: rotation.state as RotationState,
      };
    }

    const pendingIds = pendingItems.map((item) => item.id);

    // CAS claim
    const claimedRows = await tx
      .update(bucketRotationItems)
      .set({
        status: ROTATION_ITEM_STATUSES.claimed,
        claimedBy: auth.sessionId,
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
      items: claimedRows.map(toItemResult),
      rotationState: currentState,
    };
  });
}

// ── COMPLETE CHUNK ──────────────────────────────────────────────────

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

    // Update each item's status
    for (const item of parsed.data.items) {
      if (item.status === ROTATION_ITEM_STATUSES.completed) {
        await tx
          .update(bucketRotationItems)
          .set({ status: ROTATION_ITEM_STATUSES.completed, completedAt: timestamp })
          .where(eq(bucketRotationItems.id, item.itemId));
        completedDelta++;
      } else {
        // Increment attempts; mark permanently failed if max exceeded
        const [updated] = await tx
          .update(bucketRotationItems)
          .set({
            status: sql<RotationItemStatus>`CASE WHEN ${bucketRotationItems.attempts} + 1 >= ${KEY_ROTATION.maxItemAttempts} THEN 'failed' ELSE 'pending' END`,
            attempts: sql`${bucketRotationItems.attempts} + 1`,
            claimedBy: null,
            claimedAt: null,
          })
          .where(eq(bucketRotationItems.id, item.itemId))
          .returning();

        if (updated?.status === ROTATION_ITEM_STATUSES.failed) {
          failedDelta++;
        }
      }
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

// ── RETRY ──────────────────────────────────────────────────────────

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

// ── GET PROGRESS ────────────────────────────────────────────────────

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
