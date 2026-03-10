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
  // Privacy
  buckets: `
    CREATE TABLE buckets (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  bucketContentTags: `
    CREATE TABLE bucket_content_tags (
      entity_type VARCHAR(255) NOT NULL CHECK (entity_type IN ('members', 'custom-fields', 'fronting-status', 'custom-fronts', 'notes', 'chat', 'journal-entries', 'member-photos', 'groups')),
      entity_id VARCHAR(255) NOT NULL,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (entity_type, entity_id, bucket_id)
    )
  `,
  keyGrants: `
    CREATE TABLE key_grants (
      id VARCHAR(255) PRIMARY KEY,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      friend_system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_key BYTEA NOT NULL,
      key_version INTEGER NOT NULL CHECK (key_version >= 1),
      created_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      UNIQUE (bucket_id, friend_system_id, key_version)
    )
  `,
  friendConnections: `
    CREATE TABLE friend_connections (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      friend_system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'removed')),
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE (system_id, friend_system_id)
    )
  `,
  friendCodes: `
    CREATE TABLE friend_codes (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      code VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ,
      CHECK (expires_at IS NULL OR expires_at > created_at)
    )
  `,
  friendBucketAssignments: `
    CREATE TABLE friend_bucket_assignments (
      friend_connection_id VARCHAR(255) NOT NULL REFERENCES friend_connections(id) ON DELETE CASCADE,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (friend_connection_id, bucket_id)
    )
  `,
  // Fronting
  frontingSessions: `
    CREATE TABLE fronting_sessions (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (end_time IS NULL OR end_time > start_time)
    )
  `,
  switches: `
    CREATE TABLE switches (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ NOT NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  customFronts: `
    CREATE TABLE custom_fronts (
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
  frontingComments: `
    CREATE TABLE fronting_comments (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL REFERENCES fronting_sessions(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  // Structure
  relationships: `
    CREATE TABLE relationships (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  subsystems: `
    CREATE TABLE subsystems (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_subsystem_id VARCHAR(255) REFERENCES subsystems(id) ON DELETE SET NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  sideSystems: `
    CREATE TABLE side_systems (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  layers: `
    CREATE TABLE layers (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  subsystemMemberships: `
    CREATE TABLE subsystem_memberships (
      id VARCHAR(255) PRIMARY KEY,
      subsystem_id VARCHAR(255) NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  sideSystemMemberships: `
    CREATE TABLE side_system_memberships (
      id VARCHAR(255) PRIMARY KEY,
      side_system_id VARCHAR(255) NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  layerMemberships: `
    CREATE TABLE layer_memberships (
      id VARCHAR(255) PRIMARY KEY,
      layer_id VARCHAR(255) NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  subsystemLayerLinks: `
    CREATE TABLE subsystem_layer_links (
      id VARCHAR(255) PRIMARY KEY,
      subsystem_id VARCHAR(255) NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      layer_id VARCHAR(255) NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (subsystem_id, layer_id)
    )
  `,
  subsystemSideSystemLinks: `
    CREATE TABLE subsystem_side_system_links (
      id VARCHAR(255) PRIMARY KEY,
      subsystem_id VARCHAR(255) NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      side_system_id VARCHAR(255) NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (subsystem_id, side_system_id)
    )
  `,
  sideSystemLayerLinks: `
    CREATE TABLE side_system_layer_links (
      id VARCHAR(255) PRIMARY KEY,
      side_system_id VARCHAR(255) NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      layer_id VARCHAR(255) NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (side_system_id, layer_id)
    )
  `,
  // Custom Fields
  fieldDefinitions: `
    CREATE TABLE field_definitions (
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
  fieldValues: `
    CREATE TABLE field_values (
      id VARCHAR(255) PRIMARY KEY,
      field_definition_id VARCHAR(255) NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  fieldBucketVisibility: `
    CREATE TABLE field_bucket_visibility (
      field_definition_id VARCHAR(255) NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (field_definition_id, bucket_id)
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

export async function createPgPrivacyTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
  await client.query(PG_DDL.buckets);
  await client.query(PG_DDL.bucketContentTags);
  await client.query(PG_DDL.keyGrants);
  await client.query(PG_DDL.friendConnections);
  await client.query(PG_DDL.friendCodes);
  await client.query(PG_DDL.friendBucketAssignments);
}

export async function createPgFrontingTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
  await client.query(PG_DDL.frontingSessions);
  await client.query(PG_DDL.switches);
  await client.query(PG_DDL.customFronts);
  await client.query(PG_DDL.frontingComments);
}

export async function createPgStructureTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
  await client.query(PG_DDL.relationships);
  await client.query(PG_DDL.subsystems);
  await client.query(PG_DDL.sideSystems);
  await client.query(PG_DDL.layers);
  await client.query(PG_DDL.subsystemMemberships);
  await client.query(PG_DDL.sideSystemMemberships);
  await client.query(PG_DDL.layerMemberships);
  await client.query(PG_DDL.subsystemLayerLinks);
  await client.query(PG_DDL.subsystemSideSystemLinks);
  await client.query(PG_DDL.sideSystemLayerLinks);
}

export async function createPgCustomFieldsTables(client: PGlite): Promise<void> {
  await client.query(PG_DDL.accounts);
  await client.query(PG_DDL.systems);
  await client.query(PG_DDL.systemsIndexes);
  await client.query(PG_DDL.buckets);
  await client.query(PG_DDL.fieldDefinitions);
  await client.query(PG_DDL.fieldValues);
  await client.query(PG_DDL.fieldBucketVisibility);
}
