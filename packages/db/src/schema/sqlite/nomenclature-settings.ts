import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { versionCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

export const nomenclatureSettings = sqliteTable(
  "nomenclature_settings",
  {
    systemId: text("system_id")
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [check("nomenclature_settings_version_check", versionCheck(t.version))],
);
