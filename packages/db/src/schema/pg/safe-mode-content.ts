import { index, integer, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const safeModeContent = pgTable(
  "safe_mode_content",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("safe_mode_content_system_sort_idx").on(t.systemId, t.sortOrder)],
);
