import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

export const systemSettings = sqliteTable("system_settings", {
  id: text("id").primaryKey(),
  systemId: text("system_id")
    .notNull()
    .unique()
    .references(() => systems.id, { onDelete: "cascade" }),
  locale: text("locale"),
  pinHash: text("pin_hash"),
  biometricEnabled: integer("biometric_enabled", { mode: "boolean" }).notNull().default(false),
  littlesSafeModeEnabled: integer("littles_safe_mode_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
