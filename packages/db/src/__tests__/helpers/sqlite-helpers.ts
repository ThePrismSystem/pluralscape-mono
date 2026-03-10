import type Database from "better-sqlite3";

export const SQLITE_DDL = {
  accounts: `
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL UNIQUE,
      email_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  authKeys: `
    CREATE TABLE auth_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_private_key BLOB NOT NULL,
      public_key BLOB NOT NULL,
      key_type TEXT NOT NULL CHECK (key_type IN ('encryption', 'signing')),
      created_at INTEGER NOT NULL
    )
  `,
  sessions: `
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      device_info TEXT,
      created_at INTEGER NOT NULL,
      last_active INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0
    )
  `,
  sessionsIndexes: `
    CREATE INDEX sessions_revoked_last_active_idx ON sessions (revoked, last_active)
  `,
  recoveryKeys: `
    CREATE TABLE recovery_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_master_key BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  deviceTransferRequests: `
    CREATE TABLE device_transfer_requests (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      source_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      target_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      CHECK (expires_at > created_at)
    )
  `,
  deviceTransferRequestsIndexes: `
    CREATE INDEX device_transfer_requests_status_expires_idx ON device_transfer_requests (status, expires_at)
  `,
  systems: `
    CREATE TABLE systems (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  systemsIndexes: `
    CREATE INDEX systems_account_id_idx ON systems (account_id)
  `,
  members: `
    CREATE TABLE members (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER
    )
  `,
  memberPhotos: `
    CREATE TABLE member_photos (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
} as const;

export function createSqliteAuthTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.authKeys);
  client.exec(SQLITE_DDL.sessions);
  client.exec(SQLITE_DDL.sessionsIndexes);
  client.exec(SQLITE_DDL.recoveryKeys);
  client.exec(SQLITE_DDL.deviceTransferRequests);
  client.exec(SQLITE_DDL.deviceTransferRequestsIndexes);
}

export function createSqliteSystemTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
}

export function createSqliteMemberTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.memberPhotos);
}
