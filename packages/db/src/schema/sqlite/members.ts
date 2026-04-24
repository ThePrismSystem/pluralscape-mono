import { foreignKey, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("members_system_id_archived_idx").on(t.systemId, t.archived),
    index("members_created_at_idx").on(t.createdAt),
    unique("members_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("members", t.version),
    archivableConsistencyCheckFor("members", t.archived, t.archivedAt),
  ],
);

export const memberPhotos = sqliteTable(
  "member_photos",
  {
    id: brandedId<MemberPhotoId>("id").primaryKey(),
    memberId: brandedId<MemberId>("member_id").notNull(),
    /** Denormalized from members — avoids join through members for RLS queries. */
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("member_photos_system_archived_idx").on(t.systemId, t.archived),
    index("member_photos_member_sort_idx").on(t.memberId, t.sortOrder),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    versionCheckFor("member_photos", t.version),
    archivableConsistencyCheckFor("member_photos", t.archived, t.archivedAt),
  ],
);

export type MemberRow = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type MemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewMemberPhoto = InferInsertModel<typeof memberPhotos>;
