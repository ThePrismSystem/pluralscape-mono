import { index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { accounts } from "./auth.js";

/** PG systems table — top-level entity for a plural system. */
export const systems = pgTable(
  "systems",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Nullable — system can exist before profile setup during onboarding. */
    encryptedData: pgEncryptedBlob("encrypted_data"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("systems_account_id_idx").on(t.accountId)],
);
