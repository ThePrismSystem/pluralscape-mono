import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgBinary, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import { encryptedPayload } from "../../helpers/entity-shape.pg.js";
import { API_KEY_KEY_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type {
  AccountId,
  ApiKey,
  ApiKeyId,
  ApiKeyScope,
  BucketId,
  SystemId,
  T3EncryptedBytes,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Composite FK (systemId, accountId) → systems(id, accountId) enforces tenant
 * ownership at DB layer. entityIdentity does not fit because the systemId here
 * has no column-level FK — the composite table-level FK replaces it.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: brandedId<ApiKeyId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: brandedId<SystemId>("system_id").notNull(),
    keyType: varchar("key_type", { length: ENUM_MAX_LENGTH }).notNull().$type<ApiKey["keyType"]>(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    scopes: jsonb("scopes").notNull().$type<readonly ApiKeyScope[]>(),
    ...encryptedPayload(),
    encryptedKeyMaterial: pgBinary("encrypted_key_material").$type<T3EncryptedBytes>(),
    createdAt: pgTimestamp("created_at").notNull(),
    lastUsedAt: pgTimestamp("last_used_at"),
    revokedAt: pgTimestamp("revoked_at"),
    expiresAt: pgTimestamp("expires_at"),
    scopedBucketIds: jsonb("scoped_bucket_ids").$type<readonly BucketId[] | null>(),
  },
  (t) => [
    index("api_keys_account_id_idx").on(t.accountId),
    index("api_keys_system_id_idx").on(t.systemId),
    uniqueIndex("api_keys_token_hash_idx").on(t.tokenHash),
    index("api_keys_revoked_at_idx")
      .on(t.revokedAt)
      .where(sql`${t.revokedAt} IS NOT NULL`),
    index("api_keys_key_type_idx").on(t.keyType),
    check("api_keys_key_type_check", enumCheck(t.keyType, API_KEY_KEY_TYPES)),
    check(
      "api_keys_key_material_check",
      sql`(${t.keyType} = 'crypto' AND ${t.encryptedKeyMaterial} IS NOT NULL) OR (${t.keyType} = 'metadata' AND ${t.encryptedKeyMaterial} IS NULL)`,
    ),
    foreignKey({
      columns: [t.systemId, t.accountId],
      foreignColumns: [systems.id, systems.accountId],
    }).onDelete("cascade"),
  ],
);

export type ApiKeyRow = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;
