import { sqliteTable } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

import type { SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const nomenclatureSettings = sqliteTable(
  "nomenclature_settings",
  {
    systemId: brandedId<SystemId>("system_id")
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [versionCheckFor("nomenclature_settings", t.version)],
);

export type NomenclatureSettingsRow = InferSelectModel<typeof nomenclatureSettings>;
export type NewNomenclatureSettings = InferInsertModel<typeof nomenclatureSettings>;
