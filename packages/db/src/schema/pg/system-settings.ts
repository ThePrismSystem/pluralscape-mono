import { boolean, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const systemSettings = pgTable("system_settings", {
  systemId: varchar("system_id", { length: 255 })
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 255 }),
  pinHash: varchar("pin_hash", { length: 512 }),
  biometricEnabled: boolean("biometric_enabled").notNull().default(false),
  littlesSafeModeEnabled: boolean("littles_safe_mode_enabled").notNull().default(false),
  encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
