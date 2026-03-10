import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { API_KEY_KEY_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { ApiKey, ApiKeyScope } from "@pluralscape/types";

/** Account-system ownership (ensuring the account owns the system) is enforced at the app layer. */
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyType: text("key_type").notNull().$type<ApiKey["keyType"]>(),
    tokenHash: text("token_hash").notNull(),
    scopes: sqliteJson("scopes").notNull().$type<readonly ApiKeyScope[]>(),
    encryptedKeyMaterial: sqliteBinary("encrypted_key_material"),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastUsedAt: sqliteTimestamp("last_used_at"),
    revokedAt: sqliteTimestamp("revoked_at"),
    expiresAt: sqliteTimestamp("expires_at"),
    scopedBucketIds: sqliteJson("scoped_bucket_ids").$type<readonly string[]>(),
  },
  (t) => [
    index("api_keys_account_id_idx").on(t.accountId),
    index("api_keys_system_id_idx").on(t.systemId),
    uniqueIndex("api_keys_token_hash_idx").on(t.tokenHash),
    index("api_keys_revoked_at_idx").on(t.revokedAt),
    index("api_keys_key_type_idx").on(t.keyType),
    check("api_keys_key_type_check", enumCheck(t.keyType, API_KEY_KEY_TYPES)),
    check(
      "api_keys_key_material_check",
      sql`(${t.keyType} = 'crypto' AND ${t.encryptedKeyMaterial} IS NOT NULL) OR (${t.keyType} = 'metadata' AND ${t.encryptedKeyMaterial} IS NULL)`,
    ),
  ],
);
