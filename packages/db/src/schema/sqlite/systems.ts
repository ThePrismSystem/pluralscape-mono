import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";

import { accounts } from "./auth.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
  (t) => [index("systems_account_id_idx").on(t.accountId), versionCheckFor("systems", t.version)],
);

export type SystemRow = InferSelectModel<typeof systems>;
export type NewSystem = InferInsertModel<typeof systems>;
