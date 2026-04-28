import { boolean, check, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import { entityIdentity } from "../../helpers/entity-shape.pg.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import type { PKBridgeConfigId, PKSyncDirection } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: this table has three distinct encrypted blob columns
// (pk_token_encrypted, entity_mappings, error_log) instead of a single
// `encrypted_data`, so encryptedPayload does not fit. Not archivable.
export const pkBridgeConfigs = pgTable(
  "pk_bridge_configs",
  {
    ...entityIdentity<PKBridgeConfigId>(),
    enabled: boolean("enabled").notNull().default(true),
    syncDirection: varchar("sync_direction", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<PKSyncDirection>(),
    /** T1 encrypted: PluralKit API token, encrypted client-side with master key. */
    pkTokenEncrypted: pgEncryptedBlob("pk_token_encrypted").notNull(),
    /** T1 encrypted: contains member name→PK ID mappings. */
    entityMappings: pgEncryptedBlob("entity_mappings").notNull(),
    /** T1 encrypted: may contain member names in error context. */
    errorLog: pgEncryptedBlob("error_log").notNull(),
    lastSyncAt: pgTimestamp("last_sync_at"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("pk_bridge_configs_system_id_idx").on(t.systemId),
    check("pk_bridge_configs_sync_direction_check", enumCheck(t.syncDirection, PK_SYNC_DIRECTIONS)),
    versionCheckFor("pk_bridge_configs", t.version),
  ],
);

export type PkBridgeConfigRow = InferSelectModel<typeof pkBridgeConfigs>;
export type NewPkBridgeConfig = InferInsertModel<typeof pkBridgeConfigs>;
