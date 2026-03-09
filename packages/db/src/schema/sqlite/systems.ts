import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

/** SQLite systems table — top-level account entity for a plural system. */
export const systems = sqliteTable("systems", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  description: text("description"),
  avatarRef: text("avatar_ref"),
  settingsId: text("settings_id").notNull(),
  ...timestamps(),
  ...versioned(),
});
