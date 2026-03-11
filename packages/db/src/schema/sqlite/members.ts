import { foreignKey, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

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
    index("members_system_id_idx").on(t.systemId),
    index("members_archived_idx").on(t.archived),
    index("members_created_at_idx").on(t.createdAt),
    unique("members_id_system_id_unique").on(t.id, t.systemId),
  ],
);

export const memberPhotos = sqliteTable(
  "member_photos",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull(),
    /** Denormalized from members — avoids join through members for RLS queries. */
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("member_photos_system_id_idx").on(t.systemId),
    index("member_photos_member_sort_idx").on(t.memberId, t.sortOrder),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("cascade"),
  ],
);
