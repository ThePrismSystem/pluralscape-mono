import { index, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { ID_MAX_LENGTH } from "../../helpers/db.constants.js";

import { accounts } from "./auth.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/** PG systems table — top-level entity for a plural system. */
export const systems = pgTable(
  "systems",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Nullable — system can exist before profile setup during onboarding. */
    encryptedData: pgEncryptedBlob("encrypted_data"),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("systems_account_id_idx").on(t.accountId),
    unique("systems_id_account_id_unique").on(t.id, t.accountId),
    versionCheckFor("systems", t.version),
    archivableConsistencyCheckFor("systems", t.archived, t.archivedAt),
  ],
);

export type SystemRow = InferSelectModel<typeof systems>;
export type NewSystem = InferInsertModel<typeof systems>;
