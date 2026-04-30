/**
 * SQLite DDL constants — auth and core tables.
 *
 * Covers: accounts, auth_keys, sessions, recovery_keys,
 *   device_transfer_requests, systems, members, member_photos.
 * Companion files: sqlite-helpers-ddl-privacy-structure.ts,
 *   sqlite-helpers-ddl-comm-misc.ts, sqlite-helpers-schema.ts,
 *   sqlite-helpers.ts
 */

export const SQLITE_DDL_AUTH_CORE = {
  accounts: `
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL UNIQUE,
      email_salt TEXT NOT NULL,
      auth_key_hash BLOB NOT NULL,
      kdf_salt TEXT NOT NULL,
      encrypted_master_key BLOB,
      challenge_nonce BLOB,
      challenge_expires_at INTEGER,
      encrypted_email BLOB,
      account_type TEXT NOT NULL DEFAULT 'system' CHECK (account_type IN ('system', 'viewer')),
      audit_log_ip_tracking INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1)
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
      token_hash TEXT NOT NULL,
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      last_active INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      CHECK (expires_at IS NULL OR expires_at > created_at)
    )
  `,
  sessionsIndexes: `
    CREATE UNIQUE INDEX sessions_token_hash_idx ON sessions (token_hash);
    CREATE INDEX sessions_revoked_last_active_idx ON sessions (revoked, last_active);
    CREATE INDEX sessions_expires_at_idx ON sessions (expires_at) WHERE expires_at IS NOT NULL
  `,
  recoveryKeys: `
    CREATE TABLE recovery_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_master_key BLOB NOT NULL,
      recovery_key_hash BLOB,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    )
  `,
  recoveryKeysIndexes: `
    CREATE INDEX recovery_keys_account_id_idx ON recovery_keys (account_id);
    CREATE INDEX recovery_keys_revoked_at_idx ON recovery_keys (revoked_at) WHERE revoked_at IS NULL
  `,
  deviceTransferRequests: `
    CREATE TABLE device_transfer_requests (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      source_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      target_session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
      encrypted_key_material BLOB,
      code_salt BLOB NOT NULL,
      code_attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      CHECK (expires_at > created_at),
      CHECK (status != 'approved' OR encrypted_key_material IS NOT NULL)
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
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
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
      archived_at INTEGER,
      UNIQUE (id, system_id),
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  membersIndexes: `
    CREATE INDEX members_system_id_archived_idx ON members (system_id, archived);
    CREATE INDEX members_created_at_idx ON members (created_at)
  `,
  memberPhotos: `
    CREATE TABLE member_photos (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE CASCADE,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  memberPhotosIndexes: `
    CREATE INDEX member_photos_system_archived_idx ON member_photos (system_id, archived);
    CREATE INDEX member_photos_member_sort_idx ON member_photos (member_id, sort_order)
  `,
} as const;
