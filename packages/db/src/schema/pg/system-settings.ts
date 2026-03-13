import { sql } from "drizzle-orm";
import { boolean, check, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSettings = pgTable(
  "system_settings",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .unique()
      .references(() => systems.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 255 }),
    /** Must use Argon2id — PINs are low-entropy (4-6 digits) and trivially reversible with weak hashes. */
    pinHash: varchar("pin_hash", { length: 512 }),
    biometricEnabled: boolean("biometric_enabled").notNull().default(false),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    versionCheckFor("system_settings", t.version),
    check(
      "system_settings_pin_hash_kdf_check",
      sql`${t.pinHash} IS NULL OR ${t.pinHash} LIKE '$argon2id$%'`,
    ),
  ],
);

export type SystemSettingsRow = InferSelectModel<typeof systemSettings>;
export type NewSystemSettings = InferInsertModel<typeof systemSettings>;
