import type { PGlite } from "@electric-sql/pglite";

export const PG_DDL = {
  accounts: `
    CREATE TABLE accounts (
      id VARCHAR(255) PRIMARY KEY,
      email_hash VARCHAR(255) NOT NULL UNIQUE,
      email_salt VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  authKeys: `
    CREATE TABLE auth_keys (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_private_key BYTEA NOT NULL,
      public_key BYTEA NOT NULL,
      key_type VARCHAR(255) NOT NULL CHECK (key_type IN ('encryption', 'signing')),
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  sessions: `
    CREATE TABLE sessions (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      device_info VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL,
      last_active TIMESTAMPTZ,
      revoked BOOLEAN NOT NULL DEFAULT false
    )
  `,
  sessionsIndexes: `
    CREATE INDEX sessions_revoked_last_active_idx ON sessions (revoked, last_active)
  `,
  recoveryKeys: `
    CREATE TABLE recovery_keys (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_master_key BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  deviceTransferRequests: `
    CREATE TABLE device_transfer_requests (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      source_session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      target_session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      CHECK (expires_at > created_at)
    )
  `,
  deviceTransferRequestsIndexes: `
    CREATE INDEX device_transfer_requests_status_expires_idx ON device_transfer_requests (status, expires_at)
  `,
  systems: `
    CREATE TABLE systems (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  systemsIndexes: `
    CREATE INDEX systems_account_id_idx ON systems (account_id)
  `,
  members: `
    CREATE TABLE members (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  memberPhotos: `
    CREATE TABLE member_photos (
      id VARCHAR(255) PRIMARY KEY,
      member_id VARCHAR(255) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
} as const;

export async function createPgAuthTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.authKeys);
  await client.query(PG_DDL.sessions);
  await client.query(PG_DDL.sessionsIndexes);
  await client.query(PG_DDL.recoveryKeys);
  await client.query(PG_DDL.deviceTransferRequests);
  await client.query(PG_DDL.deviceTransferRequestsIndexes);
}

export async function createPgSystemTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
}

export async function createPgMemberTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
  await client.query(PG_DDL.members);
  await client.query(PG_DDL.memberPhotos);
}
