import { pgTable, varchar, text } from "drizzle-orm/pg-core";

import { timestamps, versioned } from "../../helpers/audit.pg.js";

/** PG systems table — top-level account entity for a plural system. */
export const systems = pgTable("systems", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  description: text("description"),
  avatarRef: varchar("avatar_ref", { length: 255 }),
  settingsId: varchar("settings_id", { length: 255 }).notNull(),
  ...timestamps(),
  ...versioned(),
});
