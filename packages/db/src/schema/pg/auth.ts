import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    emailHash: varchar("email_hash", { length: 255 }).notNull(),
    emailSalt: varchar("email_salt", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [uniqueIndex("accounts_email_hash_idx").on(t.emailHash)],
);

export const authKeys = pgTable(
  "auth_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedPrivateKey: pgBinary("encrypted_private_key").notNull(),
    publicKey: pgBinary("public_key").notNull(),
    keyType: varchar("key_type", { length: 255 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("auth_keys_account_id_idx").on(t.accountId),
    check("auth_keys_key_type_check", sql`${t.keyType} IN ('encryption', 'signing')`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceInfo: varchar("device_info", { length: 255 }),
    createdAt: pgTimestamp("created_at").notNull(),
    lastActive: pgTimestamp("last_active"),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [
    index("sessions_account_id_idx").on(t.accountId),
    index("sessions_revoked_idx").on(t.revoked),
  ],
);

export const recoveryKeys = pgTable(
  "recovery_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedMasterKey: pgBinary("encrypted_master_key").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [index("recovery_keys_account_id_idx").on(t.accountId)],
);

export const deviceTransferRequests = pgTable(
  "device_transfer_requests",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceSessionId: varchar("source_session_id", { length: 255 })
      .notNull()
      .references(() => sessions.id),
    targetSessionId: varchar("target_session_id", { length: 255 })
      .notNull()
      .references(() => sessions.id),
    status: varchar("status", { length: 255 }).notNull().default("pending"),
    createdAt: pgTimestamp("created_at").notNull(),
    expiresAt: pgTimestamp("expires_at").notNull(),
  },
  (t) => [
    index("device_transfer_requests_account_status_idx").on(t.accountId, t.status),
    check(
      "device_transfer_requests_status_check",
      sql`${t.status} IN ('pending', 'approved', 'expired')`,
    ),
    check("device_transfer_requests_expires_at_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
