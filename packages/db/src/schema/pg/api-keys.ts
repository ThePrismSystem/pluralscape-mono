import { check, index, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { API_KEY_KEY_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { ApiKey, ApiKeyScope } from "@pluralscape/types";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyType: varchar("key_type", { length: 255 }).notNull().$type<ApiKey["keyType"]>(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    scopes: jsonb("scopes").notNull().$type<readonly ApiKeyScope[]>(),
    encryptedKeyMaterial: pgBinary("encrypted_key_material"),
    createdAt: pgTimestamp("created_at").notNull(),
    lastUsedAt: pgTimestamp("last_used_at"),
    revokedAt: pgTimestamp("revoked_at"),
    expiresAt: pgTimestamp("expires_at"),
    scopedBucketIds: jsonb("scoped_bucket_ids").$type<readonly string[] | null>(),
  },
  (t) => [
    index("api_keys_account_id_idx").on(t.accountId),
    uniqueIndex("api_keys_token_hash_idx").on(t.tokenHash),
    index("api_keys_revoked_at_idx").on(t.revokedAt),
    index("api_keys_key_type_idx").on(t.keyType),
    check("api_keys_key_type_check", enumCheck(t.keyType, API_KEY_KEY_TYPES)),
  ],
);
