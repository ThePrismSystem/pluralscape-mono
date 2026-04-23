import { sql } from "drizzle-orm";
import { boolean, check, pgTable, varchar } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

import type { SystemId, SystemSettingsId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSettings = pgTable(
  "system_settings",
  {
    id: brandedId<SystemSettingsId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .unique()
      .references(() => systems.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 255 }),
    /** Must use Argon2id — PINs are low-entropy (4-6 digits) and trivially reversible with weak hashes. */
    pinHash: varchar("pin_hash", { length: 512 }),
    /**
     * Server-side cache of the biometricEnabled value stored inside the
     * encrypted AppLockConfig blob (encryptedData). Duplicated here so
     * the server can enforce device-transfer policies without decrypting
     * the settings blob (zero-knowledge constraint).
     */
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
