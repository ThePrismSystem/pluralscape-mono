import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { ROTATION_ITEM_STATUSES, ROTATION_STATES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { EntityType, RotationItemStatus, RotationState } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const bucketKeyRotations = sqliteTable(
  "bucket_key_rotations",
  {
    id: text("id").primaryKey(),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => buckets.id, { onDelete: "restrict" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    fromKeyVersion: integer("from_key_version").notNull(),
    toKeyVersion: integer("to_key_version").notNull(),
    state: text("state").notNull().default("initiated").$type<RotationState>(),
    initiatedAt: sqliteTimestamp("initiated_at").notNull(),
    completedAt: sqliteTimestamp("completed_at"),
    totalItems: integer("total_items").notNull(),
    completedItems: integer("completed_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
  },
  (t) => [
    index("bucket_key_rotations_bucket_state_idx").on(t.bucketId, t.state),
    index("bucket_key_rotations_system_id_idx").on(t.systemId),
    check("bucket_key_rotations_state_check", enumCheck(t.state, ROTATION_STATES)),
    check("bucket_key_rotations_version_check", sql`${t.toKeyVersion} > ${t.fromKeyVersion}`),
    check(
      "bucket_key_rotations_items_check",
      sql`${t.completedItems} + ${t.failedItems} <= ${t.totalItems}`,
    ),
  ],
);

export const bucketRotationItems = sqliteTable(
  "bucket_rotation_items",
  {
    id: text("id").primaryKey(),
    rotationId: text("rotation_id")
      .notNull()
      .references(() => bucketKeyRotations.id, { onDelete: "restrict" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().$type<EntityType>(),
    entityId: text("entity_id").notNull(),
    status: text("status").notNull().default("pending").$type<RotationItemStatus>(),
    claimedBy: text("claimed_by"),
    claimedAt: sqliteTimestamp("claimed_at"),
    completedAt: sqliteTimestamp("completed_at"),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [
    index("bucket_rotation_items_rotation_status_idx").on(t.rotationId, t.status),
    index("bucket_rotation_items_status_claimed_by_idx").on(t.status, t.claimedBy),
    index("bucket_rotation_items_system_id_idx").on(t.systemId),
    check("bucket_rotation_items_status_check", enumCheck(t.status, ROTATION_ITEM_STATUSES)),
  ],
);

export type BucketKeyRotationRow = InferSelectModel<typeof bucketKeyRotations>;
export type NewBucketKeyRotation = InferInsertModel<typeof bucketKeyRotations>;
export type BucketRotationItemRow = InferSelectModel<typeof bucketRotationItems>;
export type NewBucketRotationItem = InferInsertModel<typeof bucketRotationItems>;
