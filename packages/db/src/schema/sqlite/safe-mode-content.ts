import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { versionCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

export const safeModeContent = sqliteTable(
  "safe_mode_content",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("safe_mode_content_system_sort_idx").on(t.systemId, t.sortOrder),
    check("safe_mode_content_version_check", versionCheck(t.version)),
  ],
);
