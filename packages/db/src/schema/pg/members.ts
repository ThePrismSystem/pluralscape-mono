import { foreignKey, index, integer, pgTable, unique } from "drizzle-orm/pg-core";

import { brandedId } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";

import type { MemberId, MemberPhotoId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const members = pgTable(
  "members",
  {
    ...entityIdentity<MemberId>(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("members_system_id_archived_idx").on(t.systemId, t.archived),
    index("members_created_at_idx").on(t.createdAt),
    unique("members_id_system_id_unique").on(t.id, t.systemId),
    ...serverEntityChecks("members", t),
  ],
);

export const memberPhotos = pgTable(
  "member_photos",
  {
    ...entityIdentity<MemberPhotoId>(),
    memberId: brandedId<MemberId>("member_id").notNull(),
    /** Denormalized from members — avoids join through members for RLS queries. */
    sortOrder: integer("sort_order").notNull().default(0),
    ...encryptedPayload(),
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
    ...serverEntityChecks("member_photos", t),
  ],
);

export type MemberRow = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type MemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewMemberPhoto = InferInsertModel<typeof memberPhotos>;
