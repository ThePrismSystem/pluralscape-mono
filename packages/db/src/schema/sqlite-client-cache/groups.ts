import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { GroupId, HexColor, ImageSource, MemberId } from "@pluralscape/types";
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
 * CARVE-OUT (ADR-038): junction-storage entity. The compound CRDT key
 * `groupId:memberId` is the row identity; the parsed parts ride as
 * separate columns for indexed lookups. No `entityIdentity()` mixin
 * (`systemId`/timestamps don't apply — junctions carry no metadata
 * beyond presence). Composite FKs to `groups`/`members` are dropped
 * from the cache layer because the cache mirrors what the CRDT carries,
 * which has no `systemId` for junctions.
 */
export const groupMemberships = sqliteTable("group_memberships", {
  id: text("id").primaryKey(),
  groupId: brandedId<GroupId>("group_id").notNull(),
  memberId: brandedId<MemberId>("member_id").notNull(),
});

export type LocalGroupRow = InferSelectModel<typeof groups>;
export type NewLocalGroup = InferInsertModel<typeof groups>;
export type LocalGroupMembershipRow = InferSelectModel<typeof groupMemberships>;
export type NewLocalGroupMembership = InferInsertModel<typeof groupMemberships>;
