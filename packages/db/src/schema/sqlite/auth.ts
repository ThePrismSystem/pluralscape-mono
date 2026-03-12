import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck, versionCheck } from "../../helpers/check.js";
import { AUTH_KEY_TYPES, DEVICE_TRANSFER_STATUSES } from "../../helpers/enums.js";

import type { AuthKeyType, DeviceInfo, DeviceTransferStatus } from "@pluralscape/types";

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    emailSalt: text("email_salt").notNull(),
    passwordHash: text("password_hash").notNull(),
    kdfSalt: text("kdf_salt"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("accounts_email_hash_idx").on(t.emailHash),
    check("accounts_version_check", versionCheck(t.version)),
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
    deviceInfo: sqliteJson("device_info").$type<DeviceInfo | null>(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastActive: sqliteTimestamp("last_active"),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("sessions_account_id_idx").on(t.accountId),
    index("sessions_revoked_idx").on(t.revoked),
    index("sessions_revoked_last_active_idx").on(t.revoked, t.lastActive),
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
  },
  (t) => [index("recovery_keys_account_id_idx").on(t.accountId)],
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
    createdAt: sqliteTimestamp("created_at").notNull(),
    expiresAt: sqliteTimestamp("expires_at").notNull(),
  },
  (t) => [
    index("device_transfer_requests_account_status_idx").on(t.accountId, t.status),
    index("device_transfer_requests_status_expires_idx").on(t.status, t.expiresAt),
    check("device_transfer_requests_status_check", enumCheck(t.status, DEVICE_TRANSFER_STATUSES)),
    check("device_transfer_requests_expires_at_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
