import {
  bucketContentTags,
  bucketKeyRotations,
  bucketRotationItems,
  keyGrants,
} from "@pluralscape/db/pg";
import {
  ID_PREFIXES,
  ROTATION_ITEM_STATUSES,
  ROTATION_STATES,
  brandId,
  createId,
  now,
} from "@pluralscape/types";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toRotationResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  BucketKeyRotation,
  BucketKeyRotationId,
  BucketRotationItemId,
  KeyGrantId,
  RotationItemStatus,
  SystemId,
} from "@pluralscape/types";
import type { InitiateRotationBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function initiateRotation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  body: z.infer<typeof InitiateRotationBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketKeyRotation> {
  assertSystemOwnership(systemId, auth);

  const rotationId = brandId<BucketKeyRotationId>(createId(ID_PREFIXES.bucketKeyRotation));
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
        fromKeyVersion: body.newKeyVersion - 1,
        toKeyVersion: body.newKeyVersion,
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
          id: brandId<BucketRotationItemId>(createId(ID_PREFIXES.bucketRotationItem)),
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

    if (body.friendKeyGrants.length > 0) {
      await tx.insert(keyGrants).values(
        body.friendKeyGrants.map((grant) => ({
          id: brandId<KeyGrantId>(createId(ID_PREFIXES.keyGrant)),
          bucketId,
          systemId,
          friendAccountId: brandId<AccountId>(grant.friendAccountId),
          encryptedKey: Buffer.from(grant.encryptedKey, "base64"),
          keyVersion: body.newKeyVersion,
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
