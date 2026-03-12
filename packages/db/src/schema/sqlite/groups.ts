import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck, versionCheck } from "../../helpers/check.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentGroupId: text("parent_group_id"),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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

export const groupMemberships = sqliteTable(
  "group_memberships",
  {
    groupId: text("group_id").notNull(),
    memberId: text("member_id").notNull(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdAt: sqliteTimestamp("created_at").notNull(),
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
