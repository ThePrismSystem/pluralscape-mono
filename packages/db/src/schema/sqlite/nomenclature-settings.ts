import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

export const nomenclatureSettings = sqliteTable("nomenclature_settings", {
  systemId: text("system_id")
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: sqliteBinary("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
