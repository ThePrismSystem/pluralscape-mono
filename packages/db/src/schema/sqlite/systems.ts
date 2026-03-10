import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { accounts } from "./auth.js";

/** SQLite systems table — top-level entity for a plural system. */
export const systems = sqliteTable(
  "systems",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Nullable — system can exist before profile setup during onboarding. */
    encryptedData: sqliteBinary("encrypted_data"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("systems_account_id_idx").on(t.accountId)],
);
