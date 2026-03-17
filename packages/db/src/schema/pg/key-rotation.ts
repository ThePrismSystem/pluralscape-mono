import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
import { ROTATION_ITEM_STATUSES, ROTATION_STATES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { EntityType, RotationItemStatus, RotationState } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const bucketKeyRotations = pgTable(
  "bucket_key_rotations",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => buckets.id, { onDelete: "restrict" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    fromKeyVersion: integer("from_key_version").notNull(),
    toKeyVersion: integer("to_key_version").notNull(),
    state: varchar("state", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("initiated")
      .$type<RotationState>(),
    initiatedAt: pgTimestamp("initiated_at").notNull(),
    completedAt: pgTimestamp("completed_at"),
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

export const bucketRotationItems = pgTable(
  "bucket_rotation_items",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    rotationId: varchar("rotation_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => bucketKeyRotations.id, { onDelete: "restrict" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: ENUM_MAX_LENGTH }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<RotationItemStatus>(),
    claimedBy: varchar("claimed_by", { length: 255 }),
    claimedAt: pgTimestamp("claimed_at"),
    completedAt: pgTimestamp("completed_at"),
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
