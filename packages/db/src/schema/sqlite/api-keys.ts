import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteBinary, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { encryptedPayload, entityIdentity } from "../../helpers/entity-shape.sqlite.js";
import { API_KEY_KEY_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";

import type { AccountId, ApiKey, ApiKeyId, ApiKeyScope, BucketId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Account-system ownership (ensuring the account owns the system) is enforced
 * at the app layer.
 *
 * Carve-out: bespoke createdAt/lastUsedAt/revokedAt/expiresAt instead of the
 * standard `timestamps()` mixin; no audit columns.
 */
export const apiKeys = sqliteTable(
  "api_keys",
  {
    ...entityIdentity<ApiKeyId>(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    keyType: text("key_type").notNull().$type<ApiKey["keyType"]>(),
    tokenHash: text("token_hash").notNull(),
    scopes: sqliteJson("scopes").notNull().$type<readonly ApiKeyScope[]>(),
    ...encryptedPayload(),
    encryptedKeyMaterial: sqliteBinary("encrypted_key_material"),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastUsedAt: sqliteTimestamp("last_used_at"),
    revokedAt: sqliteTimestamp("revoked_at"),
    expiresAt: sqliteTimestamp("expires_at"),
    scopedBucketIds: sqliteJson("scoped_bucket_ids").$type<readonly BucketId[] | null>(),
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

export type ApiKeyRow = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;
