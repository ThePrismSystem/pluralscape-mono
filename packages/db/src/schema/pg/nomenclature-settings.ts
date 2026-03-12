import { pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const nomenclatureSettings = pgTable(
  "nomenclature_settings",
  {
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [versionCheckFor("nomenclature_settings", t.version)],
);

export type NomenclatureSettingsRow = InferSelectModel<typeof nomenclatureSettings>;
export type NewNomenclatureSettings = InferInsertModel<typeof nomenclatureSettings>;
