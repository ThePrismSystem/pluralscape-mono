import { pgTable } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

import type { SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const nomenclatureSettings = pgTable(
  "nomenclature_settings",
  {
    systemId: brandedId<SystemId>("system_id")
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
