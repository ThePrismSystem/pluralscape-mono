import { index, pgTable, unique } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";

import { accounts } from "./auth.js";

import type { AccountId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/** PG systems table — top-level entity for a plural system. */
export const systems = pgTable(
  "systems",
  {
    id: brandedId<SystemId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
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
