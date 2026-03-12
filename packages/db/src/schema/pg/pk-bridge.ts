import { boolean, check, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck, versionCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { PKSyncDirection } from "@pluralscape/types";

export const pkBridgeState = pgTable(
  "pk_bridge_state",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    syncDirection: varchar("sync_direction", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<PKSyncDirection>(),
    pkTokenEncrypted: pgBinary("pk_token_encrypted").notNull(),
    entityMappings: pgBinary("entity_mappings").notNull(),
    errorLog: pgBinary("error_log").notNull(),
    lastSyncAt: pgTimestamp("last_sync_at"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("pk_bridge_state_system_id_idx").on(t.systemId),
    check("pk_bridge_state_sync_direction_check", enumCheck(t.syncDirection, PK_SYNC_DIRECTIONS)),
    check("pk_bridge_state_version_check", versionCheck(t.version)),
  ],
);
