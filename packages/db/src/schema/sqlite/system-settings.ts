import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId } from "../../columns/sqlite.js";
import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.sqlite.js";
import { encryptedPayload } from "../../helpers/entity-shape.sqlite.js";

import { systems } from "./systems.js";

import type { Locale, PinHash, SystemId, SystemSettingsId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: system_settings is a singleton per system (systemId is UNIQUE),
// not a generic system-scoped entity. The encryptedPayload mixin still applies.
export const systemSettings = sqliteTable(
  "system_settings",
  {
    id: brandedId<SystemSettingsId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .unique()
      .references(() => systems.id, { onDelete: "cascade" }),
    locale: text("locale").$type<Locale>(),
    /** Must use Argon2id — PINs are low-entropy (4-6 digits) and trivially reversible with weak hashes. */
    pinHash: text("pin_hash").$type<PinHash | null>(),
    biometricEnabled: integer("biometric_enabled", { mode: "boolean" }).notNull().default(false),
    ...encryptedPayload(),
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
