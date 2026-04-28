import { foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import { members } from "./members.js";

import type { GroupId, HexColor, ImageSource, MemberId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `Group`. Mirrors the `Group` domain
 * type from `@pluralscape/types` per the encoding rules in ADR-038.
 */
export const groups = sqliteTable("groups", {
  ...entityIdentity<GroupId>(),
  name: text("name").notNull(),
  description: text("description"),
  parentGroupId: brandedId<GroupId>("parent_group_id"),
  imageSource: sqliteJsonOf<ImageSource | null>("image_source"),
  color: text("color").$type<HexColor | null>(),
  emoji: text("emoji"),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * CARVE-OUT: pure link table. `GroupMembership` (from @pluralscape/types) only
 * exposes (groupId, memberId); the systemId and createdAt are persistence
 * metadata required for the composite FKs.
 */
export const groupMemberships = sqliteTable(
  "group_memberships",
  {
    groupId: brandedId<GroupId>("group_id").notNull(),
    memberId: brandedId<MemberId>("member_id").notNull(),
    systemId: brandedId<SystemId>("system_id").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.memberId] }),
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

export type LocalGroupRow = InferSelectModel<typeof groups>;
export type NewLocalGroup = InferInsertModel<typeof groups>;
export type LocalGroupMembershipRow = InferSelectModel<typeof groupMemberships>;
export type NewLocalGroupMembership = InferInsertModel<typeof groupMemberships>;
