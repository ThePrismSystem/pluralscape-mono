import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { versionCheck } from "../../helpers/check.js";

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
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("systems_account_id_idx").on(t.accountId),
    check("systems_version_check", versionCheck(t.version)),
  ],
);
