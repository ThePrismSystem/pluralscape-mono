import { boolean, check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { PKSyncDirection } from "@pluralscape/types";

export const pkBridgeState = pgTable(
  "pk_bridge_state",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    syncDirection: varchar("sync_direction", { length: 255 }).notNull().$type<PKSyncDirection>(),
    pkTokenEncrypted: pgBinary("pk_token_encrypted").notNull(),
    entityMappings: pgBinary("entity_mappings").notNull(),
    errorLog: pgBinary("error_log").notNull(),
    lastSyncAt: pgTimestamp("last_sync_at"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("pk_bridge_state_system_id_idx").on(t.systemId),
    check("pk_bridge_state_sync_direction_check", enumCheck(t.syncDirection, PK_SYNC_DIRECTIONS)),
  ],
);
