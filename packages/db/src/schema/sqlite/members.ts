import { foreignKey, index, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import {
  commonEntityIndexes,
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";

import { systems } from "./systems.js";

import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const members = sqliteTable(
  "members",
  {
    ...entityIdentity<MemberId>(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [...commonEntityIndexes("members", t), ...serverEntityChecks("members", t)],
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
