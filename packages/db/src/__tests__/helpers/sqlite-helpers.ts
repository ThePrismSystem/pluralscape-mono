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
  // Privacy
  buckets: `
    CREATE TABLE buckets (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  bucketContentTags: `
    CREATE TABLE bucket_content_tags (
      entity_type TEXT NOT NULL CHECK (entity_type IN ('members', 'custom-fields', 'fronting-status', 'custom-fronts', 'notes', 'chat', 'journal-entries', 'member-photos', 'groups')),
      entity_id TEXT NOT NULL,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (entity_type, entity_id, bucket_id)
    )
  `,
  keyGrants: `
    CREATE TABLE key_grants (
      id TEXT PRIMARY KEY,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      friend_system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_key BLOB NOT NULL,
      key_version INTEGER NOT NULL CHECK (key_version >= 1),
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      UNIQUE (bucket_id, friend_system_id, key_version)
    )
  `,
  friendConnections: `
    CREATE TABLE friend_connections (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      friend_system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'removed')),
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE (system_id, friend_system_id)
    )
  `,
  friendCodes: `
    CREATE TABLE friend_codes (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      CHECK (expires_at IS NULL OR expires_at > created_at)
    )
  `,
  friendBucketAssignments: `
    CREATE TABLE friend_bucket_assignments (
      friend_connection_id TEXT NOT NULL REFERENCES friend_connections(id) ON DELETE CASCADE,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (friend_connection_id, bucket_id)
    )
  `,
  // Fronting
  frontingSessions: `
    CREATE TABLE fronting_sessions (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (end_time IS NULL OR end_time > start_time)
    )
  `,
  switches: `
    CREATE TABLE switches (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  customFronts: `
    CREATE TABLE custom_fronts (
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
  frontingComments: `
    CREATE TABLE fronting_comments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES fronting_sessions(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  // Structure
  relationships: `
    CREATE TABLE relationships (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  subsystems: `
    CREATE TABLE subsystems (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_subsystem_id TEXT REFERENCES subsystems(id) ON DELETE SET NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  sideSystems: `
    CREATE TABLE side_systems (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  layers: `
    CREATE TABLE layers (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  subsystemMemberships: `
    CREATE TABLE subsystem_memberships (
      id TEXT PRIMARY KEY,
      subsystem_id TEXT NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  sideSystemMemberships: `
    CREATE TABLE side_system_memberships (
      id TEXT PRIMARY KEY,
      side_system_id TEXT NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  layerMemberships: `
    CREATE TABLE layer_memberships (
      id TEXT PRIMARY KEY,
      layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  subsystemLayerLinks: `
    CREATE TABLE subsystem_layer_links (
      id TEXT PRIMARY KEY,
      subsystem_id TEXT NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      UNIQUE (subsystem_id, layer_id)
    )
  `,
  subsystemSideSystemLinks: `
    CREATE TABLE subsystem_side_system_links (
      id TEXT PRIMARY KEY,
      subsystem_id TEXT NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
      side_system_id TEXT NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      UNIQUE (subsystem_id, side_system_id)
    )
  `,
  sideSystemLayerLinks: `
    CREATE TABLE side_system_layer_links (
      id TEXT PRIMARY KEY,
      side_system_id TEXT NOT NULL REFERENCES side_systems(id) ON DELETE CASCADE,
      layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      UNIQUE (side_system_id, layer_id)
    )
  `,
  // Custom Fields
  fieldDefinitions: `
    CREATE TABLE field_definitions (
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
  fieldValues: `
    CREATE TABLE field_values (
      id TEXT PRIMARY KEY,
      field_definition_id TEXT NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  fieldBucketVisibility: `
    CREATE TABLE field_bucket_visibility (
      field_definition_id TEXT NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (field_definition_id, bucket_id)
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

export function createSqlitePrivacyTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.bucketContentTags);
  client.exec(SQLITE_DDL.keyGrants);
  client.exec(SQLITE_DDL.friendConnections);
  client.exec(SQLITE_DDL.friendCodes);
  client.exec(SQLITE_DDL.friendBucketAssignments);
}

export function createSqliteFrontingTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
  client.exec(SQLITE_DDL.frontingSessions);
  client.exec(SQLITE_DDL.switches);
  client.exec(SQLITE_DDL.customFronts);
  client.exec(SQLITE_DDL.frontingComments);
}

export function createSqliteStructureTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
  client.exec(SQLITE_DDL.relationships);
  client.exec(SQLITE_DDL.subsystems);
  client.exec(SQLITE_DDL.sideSystems);
  client.exec(SQLITE_DDL.layers);
  client.exec(SQLITE_DDL.subsystemMemberships);
  client.exec(SQLITE_DDL.sideSystemMemberships);
  client.exec(SQLITE_DDL.layerMemberships);
  client.exec(SQLITE_DDL.subsystemLayerLinks);
  client.exec(SQLITE_DDL.subsystemSideSystemLinks);
  client.exec(SQLITE_DDL.sideSystemLayerLinks);
}

export function createSqliteCustomFieldsTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.fieldDefinitions);
  client.exec(SQLITE_DDL.fieldValues);
  client.exec(SQLITE_DDL.fieldBucketVisibility);
}
