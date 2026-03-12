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
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

export const groups = pgTable(
  "groups",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentGroupId: varchar("parent_group_id", { length: ID_MAX_LENGTH }),
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
      columns: [t.parentGroupId, t.systemId],
      foreignColumns: [t.id, t.systemId],
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
