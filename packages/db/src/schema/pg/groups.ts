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

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck, versionCheck } from "../../helpers/check.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

export const groups = pgTable(
  "groups",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentGroupId: varchar("parent_group_id", { length: 255 }),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("groups_system_id_idx").on(t.systemId),
    unique("groups_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentGroupId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("groups_sort_order_check", sql`${t.sortOrder} >= 0`),
    check("groups_version_check", versionCheck(t.version)),
    check(
      "groups_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    groupId: varchar("group_id", { length: 255 }).notNull(),
    memberId: varchar("member_id", { length: 255 }).notNull(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.memberId] }),
    index("group_memberships_member_id_idx").on(t.memberId),
    index("group_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.groupId, t.systemId],
      foreignColumns: [groups.id, groups.systemId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("cascade"),
  ],
);
