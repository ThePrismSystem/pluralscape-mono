import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { PKSyncDirection } from "@pluralscape/types";

export const pkBridgeState = sqliteTable(
  "pk_bridge_state",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    syncDirection: text("sync_direction").notNull().$type<PKSyncDirection>(),
    pkTokenEncrypted: sqliteBinary("pk_token_encrypted").notNull(),
    entityMappings: sqliteBinary("entity_mappings").notNull(),
    errorLog: sqliteBinary("error_log").notNull(),
    lastSyncAt: sqliteTimestamp("last_sync_at"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("pk_bridge_state_system_id_idx").on(t.systemId),
    check("pk_bridge_state_sync_direction_check", enumCheck(t.syncDirection, PK_SYNC_DIRECTIONS)),
  ],
);
