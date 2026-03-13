import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSettings = sqliteTable(
  "system_settings",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .unique()
      .references(() => systems.id, { onDelete: "cascade" }),
    locale: text("locale"),
    /** Must use Argon2id — PINs are low-entropy (4-6 digits) and trivially reversible with weak hashes. */
    pinHash: text("pin_hash"),
    biometricEnabled: integer("biometric_enabled", { mode: "boolean" }).notNull().default(false),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [versionCheckFor("system_settings", t.version)],
);

export type SystemSettingsRow = InferSelectModel<typeof systemSettings>;
export type NewSystemSettings = InferInsertModel<typeof systemSettings>;
