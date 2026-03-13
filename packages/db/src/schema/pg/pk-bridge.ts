import { boolean, check, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { PKSyncDirection } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
    /** T1 encrypted: contains member name→PK ID mappings. Must be encrypted before storage. */
    entityMappings: pgBinary("entity_mappings").notNull(),
    /** T1 encrypted: may contain member names in error context. Must be encrypted before storage. */
    errorLog: pgBinary("error_log").notNull(),
    lastSyncAt: pgTimestamp("last_sync_at"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("pk_bridge_state_system_id_idx").on(t.systemId),
    check("pk_bridge_state_sync_direction_check", enumCheck(t.syncDirection, PK_SYNC_DIRECTIONS)),
    versionCheckFor("pk_bridge_state", t.version),
  ],
);

export type PkBridgeStateRow = InferSelectModel<typeof pkBridgeState>;
export type NewPkBridgeState = InferInsertModel<typeof pkBridgeState>;
