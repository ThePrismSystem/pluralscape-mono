import { index, integer, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const members = pgTable(
  "members",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("members_system_id_idx").on(t.systemId),
    index("members_archived_idx").on(t.archived),
    index("members_created_at_idx").on(t.createdAt),
  ],
);

export const memberPhotos = pgTable(
  "member_photos",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    memberId: varchar("member_id", { length: 255 })
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** Denormalized from members — avoids join through members for RLS queries. */
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("member_photos_system_id_idx").on(t.systemId),
    index("member_photos_member_sort_idx").on(t.memberId, t.sortOrder),
  ],
);
