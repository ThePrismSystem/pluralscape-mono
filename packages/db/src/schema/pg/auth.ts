import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck, versionCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { AUTH_KEY_TYPES, DEVICE_TRANSFER_STATUSES } from "../../helpers/enums.js";

import type { AuthKeyType, DeviceInfo, DeviceTransferStatus } from "@pluralscape/types";

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    emailHash: varchar("email_hash", { length: 255 }).notNull(),
    emailSalt: varchar("email_salt", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    kdfSalt: varchar("kdf_salt", { length: 255 }).notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    uniqueIndex("accounts_email_hash_idx").on(t.emailHash),
    check("accounts_version_check", versionCheck(t.version)),
  ],
);

export const authKeys = pgTable(
  "auth_keys",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedPrivateKey: pgBinary("encrypted_private_key").notNull(),
    publicKey: pgBinary("public_key").notNull(),
    keyType: varchar("key_type", { length: ENUM_MAX_LENGTH }).notNull().$type<AuthKeyType>(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("auth_keys_account_id_idx").on(t.accountId),
    check("auth_keys_key_type_check", enumCheck(t.keyType, AUTH_KEY_TYPES)),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceInfo: jsonb("device_info").$type<DeviceInfo | null>(),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
    lastActive: pgTimestamp("last_active"),
    revoked: boolean("revoked").notNull().default(false),
    expiresAt: pgTimestamp("expires_at"),
  },
  (t) => [
    index("sessions_account_id_idx").on(t.accountId),
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

export const recoveryKeys = pgTable(
  "recovery_keys",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedMasterKey: pgBinary("encrypted_master_key").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("recovery_keys_account_id_idx").on(t.accountId),
    index("recovery_keys_revoked_at_idx")
      .on(t.revokedAt)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

export const deviceTransferRequests = pgTable(
  "device_transfer_requests",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceSessionId: varchar("source_session_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    targetSessionId: varchar("target_session_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<DeviceTransferStatus>(),
    encryptedKeyMaterial: pgBinary("encrypted_key_material"),
    createdAt: pgTimestamp("created_at").notNull(),
    expiresAt: pgTimestamp("expires_at").notNull(),
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
