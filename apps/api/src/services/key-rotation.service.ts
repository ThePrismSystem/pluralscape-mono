import {
  bucketContentTags,
  bucketKeyRotations,
  bucketRotationItems,
  keyGrants,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, KEY_ROTATION, createId, now } from "@pluralscape/types";
import {
  ClaimChunkBodySchema,
  CompleteChunkBodySchema,
  InitiateRotationBodySchema,
} from "@pluralscape/validation";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

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
  UnixMillis,
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
    initiatedAt: row.initiatedAt as UnixMillis,
    completedAt: row.completedAt as UnixMillis | null,
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
    claimedAt: row.claimedAt as UnixMillis | null,
    completedAt: row.completedAt as UnixMillis | null,
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
  await assertSystemOwnership(db, systemId, auth);

  const parsed = InitiateRotationBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid initiate payload");
  }

  // Check for active rotation on this bucket
  const [activeRotation] = await db
    .select()
    .from(bucketKeyRotations)
    .where(
      and(
        eq(bucketKeyRotations.bucketId, bucketId),
        eq(bucketKeyRotations.systemId, systemId),
        inArray(bucketKeyRotations.state, ["initiated", "migrating", "sealing"]),
      ),
    )
    .limit(1);

  if (activeRotation) {
    if (activeRotation.state === "initiated") {
      // Cancel the unclaimed rotation and proceed
      await db
        .update(bucketKeyRotations)
        .set({ state: "failed" })
        .where(eq(bucketKeyRotations.id, activeRotation.id));
    } else {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "ROTATION_IN_PROGRESS",
        "A rotation is already in progress for this bucket",
      );
    }
  }

  const rotationId = createId(ID_PREFIXES.bucketKeyRotation);
  const timestamp = now();

  return db.transaction(async (tx) => {
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
        state: "initiated",
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
          status: "pending" as RotationItemStatus,
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
  await assertSystemOwnership(db, systemId, auth);

  const parsed = ClaimChunkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid claim payload");
  }

  const chunkSize = parsed.data.chunkSize;

  // Verify rotation exists and belongs to this system/bucket
  const [rotation] = await db
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

  if (rotation.state !== "initiated" && rotation.state !== "migrating") {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "CONFLICT",
      `Rotation is in state "${rotation.state}" — cannot claim chunks`,
    );
  }

  const timestamp = now();
  const staleThreshold = (timestamp - KEY_ROTATION.staleClaimTimeoutMs) as UnixMillis;

  // Reclaim stale items
  await db
    .update(bucketRotationItems)
    .set({ status: "pending", claimedBy: null, claimedAt: null })
    .where(
      and(
        eq(bucketRotationItems.rotationId, rotationId),
        eq(bucketRotationItems.status, "claimed"),
        lt(bucketRotationItems.claimedAt, staleThreshold),
      ),
    );

  // Select pending items
  const pendingItems = await db
    .select({ id: bucketRotationItems.id })
    .from(bucketRotationItems)
    .where(
      and(
        eq(bucketRotationItems.rotationId, rotationId),
        eq(bucketRotationItems.status, "pending"),
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
  const claimedRows = await db
    .update(bucketRotationItems)
    .set({
      status: "claimed",
      claimedBy: auth.sessionId,
      claimedAt: timestamp,
    })
    .where(
      and(inArray(bucketRotationItems.id, pendingIds), eq(bucketRotationItems.status, "pending")),
    )
    .returning();

  // Transition initiated → migrating on first claim
  let currentState = rotation.state as RotationState;
  if (currentState === "initiated" && claimedRows.length > 0) {
    await db
      .update(bucketKeyRotations)
      .set({ state: "migrating" })
      .where(and(eq(bucketKeyRotations.id, rotationId), eq(bucketKeyRotations.state, "initiated")));
    currentState = "migrating";
  }

  return {
    items: claimedRows.map(toItemResult),
    rotationState: currentState,
  };
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
  await assertSystemOwnership(db, systemId, auth);

  const parsed = CompleteChunkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid completion payload");
  }

  return db.transaction(async (tx) => {
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

    if (rotation.state !== "migrating") {
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
      if (item.status === "completed") {
        await tx
          .update(bucketRotationItems)
          .set({ status: "completed", completedAt: timestamp })
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

        if (updated?.status === "failed") {
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
        );

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
            status: "pending" as RotationItemStatus,
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
            state: "failed",
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
            state: "completed",
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

// ── GET PROGRESS ────────────────────────────────────────────────────

export async function getRotationProgress(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  rotationId: BucketKeyRotationId,
  auth: AuthContext,
): Promise<BucketKeyRotation> {
  await assertSystemOwnership(db, systemId, auth);

  const [rotation] = await db
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
}
