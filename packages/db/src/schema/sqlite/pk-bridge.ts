import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";
import { PK_SYNC_DIRECTIONS } from "../../helpers/enums.js";

import type { PKBridgeConfigId, PKSyncDirection } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: this table has three distinct encrypted blob columns
// (pk_token_encrypted, entity_mappings, error_log) instead of a single
// `encrypted_data`, so encryptedPayload does not fit. Not archivable.
export const pkBridgeConfigs = sqliteTable(
  "pk_bridge_configs",
  {
    ...entityIdentity<PKBridgeConfigId>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    syncDirection: text("sync_direction").notNull().$type<PKSyncDirection>(),
    /** T1 encrypted: PluralKit API token, encrypted client-side with master key. */
    pkTokenEncrypted: sqliteEncryptedBlob("pk_token_encrypted").notNull(),
    /** T1 encrypted: contains member name→PK ID mappings. */
    entityMappings: sqliteEncryptedBlob("entity_mappings").notNull(),
    /** T1 encrypted: may contain member names in error context. */
    errorLog: sqliteEncryptedBlob("error_log").notNull(),
    lastSyncAt: sqliteTimestamp("last_sync_at"),
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
