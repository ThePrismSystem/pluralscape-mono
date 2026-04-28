import { pgTable } from "drizzle-orm/pg-core";

import { brandedId } from "../../columns/pg.js";
import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.pg.js";
import { encryptedPayload } from "../../helpers/entity-shape.pg.js";

import { systems } from "./systems.js";

import type { SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Singleton per system — systemId is the primary key. entityIdentity does not
// fit (no separate id column).
export const nomenclatureSettings = pgTable(
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
