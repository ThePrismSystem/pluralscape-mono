import { boolean, check, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { versionCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

export const systemSettings = pgTable(
  "system_settings",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .unique()
      .references(() => systems.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 255 }),
    pinHash: varchar("pin_hash", { length: 512 }),
    biometricEnabled: boolean("biometric_enabled").notNull().default(false),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [check("system_settings_version_check", versionCheck(t.version))],
);
