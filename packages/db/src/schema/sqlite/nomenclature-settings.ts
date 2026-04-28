import { sqliteTable } from "drizzle-orm/sqlite-core";

import { brandedId } from "../../columns/sqlite.js";
import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.sqlite.js";
import { encryptedPayload } from "../../helpers/entity-shape.sqlite.js";

import { systems } from "./systems.js";

import type { SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Singleton per system — systemId is the primary key. entityIdentity does not
// fit (no separate id column).
export const nomenclatureSettings = sqliteTable(
  "nomenclature_settings",
  {
    systemId: brandedId<SystemId>("system_id")
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [versionCheckFor("nomenclature_settings", t.version)],
);

export type NomenclatureSettingsRow = InferSelectModel<typeof nomenclatureSettings>;
export type NewNomenclatureSettings = InferInsertModel<typeof nomenclatureSettings>;
