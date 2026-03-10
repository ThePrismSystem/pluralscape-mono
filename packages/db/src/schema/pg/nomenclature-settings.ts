import { pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const nomenclatureSettings = pgTable("nomenclature_settings", {
  systemId: varchar("system_id", { length: 255 })
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: pgBinary("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
