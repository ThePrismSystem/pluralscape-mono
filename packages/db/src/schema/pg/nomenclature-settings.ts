import { check, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { versionCheck } from "../../helpers/check.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

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
  (t) => [check("nomenclature_settings_version_check", versionCheck(t.version))],
);
