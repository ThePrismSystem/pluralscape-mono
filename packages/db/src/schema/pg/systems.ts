import { pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { accounts } from "./auth.js";

/** PG systems table — top-level entity for a plural system. */
export const systems = pgTable("systems", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  encryptedData: pgBinary("encrypted_data"),
  ...timestamps(),
  ...versioned(),
});
