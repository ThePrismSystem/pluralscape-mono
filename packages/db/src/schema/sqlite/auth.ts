import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { ACCOUNT_TYPES, AUTH_KEY_TYPES, DEVICE_TRANSFER_STATUSES } from "../../helpers/enums.js";

import type { AccountType, AuthKeyType, DeviceTransferStatus } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountType: text("account_type").notNull().default("system").$type<AccountType>(),
    emailHash: text("email_hash").notNull(),
    emailSalt: text("email_salt").notNull(),
    passwordHash: text("password_hash").notNull(),
    kdfSalt: text("kdf_salt").notNull(),
    // Two-layer KEK/DEK: persistent random MasterKey wrapped by password-derived key.
    // Null for legacy accounts that have not yet migrated to the two-layer architecture.
    encryptedMasterKey: sqliteBinary("encrypted_master_key"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("accounts_email_hash_idx").on(t.emailHash),
    check("accounts_account_type_check", enumCheck(t.accountType, ACCOUNT_TYPES)),
    versionCheckFor("accounts", t.version),
  ],
);

export const authKeys = sqliteTable(
  "auth_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedPrivateKey: sqliteBinary("encrypted_private_key").notNull(),
    publicKey: sqliteBinary("public_key").notNull(),
    keyType: text("key_type").notNull().$type<AuthKeyType>(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("auth_keys_account_id_idx").on(t.accountId),
    check("auth_keys_key_type_check", enumCheck(t.keyType, AUTH_KEY_TYPES)),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastActive: sqliteTimestamp("last_active"),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
    expiresAt: sqliteTimestamp("expires_at"),
  },
  (t) => [
    index("sessions_account_id_idx").on(t.accountId),
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_revoked_last_active_idx").on(t.revoked, t.lastActive),
    index("sessions_expires_at_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
    check(
      "sessions_expires_at_check",
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`,
    ),
  ],
);

export const recoveryKeys = sqliteTable(
  "recovery_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedMasterKey: sqliteBinary("encrypted_master_key").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    revokedAt: sqliteTimestamp("revoked_at"),
  },
  (t) => [
    index("recovery_keys_account_id_idx").on(t.accountId),
    index("recovery_keys_revoked_at_idx")
      .on(t.revokedAt)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

export const deviceTransferRequests = sqliteTable(
  "device_transfer_requests",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceSessionId: text("source_session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    targetSessionId: text("target_session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending").$type<DeviceTransferStatus>(),
    encryptedKeyMaterial: sqliteBinary("encrypted_key_material"),
    createdAt: sqliteTimestamp("created_at").notNull(),
    expiresAt: sqliteTimestamp("expires_at").notNull(),
  },
  (t) => [
    index("device_transfer_requests_account_status_idx").on(t.accountId, t.status),
    index("device_transfer_requests_status_expires_idx").on(t.status, t.expiresAt),
    check("device_transfer_requests_status_check", enumCheck(t.status, DEVICE_TRANSFER_STATUSES)),
    check("device_transfer_requests_expires_at_check", sql`${t.expiresAt} > ${t.createdAt}`),
    check(
      "device_transfer_requests_key_material_check",
      sql`${t.status} != 'approved' OR ${t.encryptedKeyMaterial} IS NOT NULL`,
    ),
  ],
);

export type AccountRow = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type AuthKeyRow = InferSelectModel<typeof authKeys>;
export type NewAuthKey = InferInsertModel<typeof authKeys>;
export type SessionRow = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type RecoveryKeyRow = InferSelectModel<typeof recoveryKeys>;
export type NewRecoveryKey = InferInsertModel<typeof recoveryKeys>;
export type DeviceTransferRequestRow = InferSelectModel<typeof deviceTransferRequests>;
export type NewDeviceTransferRequest = InferInsertModel<typeof deviceTransferRequests>;
