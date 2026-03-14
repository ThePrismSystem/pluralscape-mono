import { check, foreignKey, index, integer, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck } from "../../helpers/check.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const members = pgTable(
  "members",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("members_system_id_archived_idx").on(t.systemId, t.archived),
    index("members_created_at_idx").on(t.createdAt),
    unique("members_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("members", t.version),
    check(
      "members_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const memberPhotos = pgTable(
  "member_photos",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
    /** Denormalized from members — avoids join through members for RLS queries. */
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("member_photos_system_id_idx").on(t.systemId),
    index("member_photos_member_sort_idx").on(t.memberId, t.sortOrder),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("cascade"),
    versionCheckFor("member_photos", t.version),
    check(
      "member_photos_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export type MemberRow = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type MemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewMemberPhoto = InferInsertModel<typeof memberPhotos>;
