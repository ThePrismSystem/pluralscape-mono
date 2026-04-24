import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { ID_MAX_LENGTH } from "../../helpers/db.constants.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { GroupId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const groups = pgTable(
  "groups",
  {
    id: brandedId<GroupId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentGroupId: brandedId<GroupId>("parent_group_id"),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("groups_system_archived_idx").on(t.systemId, t.archived),
    unique("groups_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentGroupId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("restrict"),
    check("groups_sort_order_check", sql`${t.sortOrder} >= 0`),
    versionCheckFor("groups", t.version),
    archivableConsistencyCheckFor("groups", t.archived, t.archivedAt),
  ],
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    groupId: varchar("group_id", { length: ID_MAX_LENGTH }).notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.memberId] }),
    index("group_memberships_member_id_idx").on(t.memberId),
    index("group_memberships_system_id_idx").on(t.systemId),
    index("group_memberships_system_group_idx").on(t.systemId, t.groupId),
    foreignKey({
      columns: [t.groupId, t.systemId],
      foreignColumns: [groups.id, groups.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export type GroupRow = InferSelectModel<typeof groups>;
export type NewGroup = InferInsertModel<typeof groups>;
export type GroupMembershipRow = InferSelectModel<typeof groupMemberships>;
export type NewGroupMembership = InferInsertModel<typeof groupMemberships>;
