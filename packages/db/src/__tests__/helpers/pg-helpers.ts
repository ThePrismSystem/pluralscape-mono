import { accounts } from "../../schema/pg/auth.js";
import { systems } from "../../schema/pg/systems.js";

import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

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
  bucketsIndexes: `
    CREATE INDEX buckets_system_id_idx ON buckets (system_id)
  `,
  bucketContentTags: `
    CREATE TABLE bucket_content_tags (
      entity_type VARCHAR(255) NOT NULL CHECK (entity_type IN ('members', 'custom-fields', 'fronting-status', 'custom-fronts', 'notes', 'chat', 'journal-entries', 'member-photos', 'groups')),
      entity_id VARCHAR(255) NOT NULL,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (entity_type, entity_id, bucket_id)
    )
  `,
  bucketContentTagsIndexes: `
    CREATE INDEX bucket_content_tags_entity_idx ON bucket_content_tags (entity_type, entity_id);
    CREATE INDEX bucket_content_tags_bucket_id_idx ON bucket_content_tags (bucket_id)
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
  keyGrantsIndexes: `
    CREATE INDEX key_grants_friend_bucket_idx ON key_grants (friend_system_id, bucket_id);
    CREATE INDEX key_grants_revoked_at_idx ON key_grants (revoked_at)
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
      UNIQUE (system_id, friend_system_id),
      CHECK (system_id != friend_system_id)
    )
  `,
  friendConnectionsIndexes: `
    CREATE INDEX friend_connections_system_status_idx ON friend_connections (system_id, status);
    CREATE INDEX friend_connections_friend_system_id_idx ON friend_connections (friend_system_id)
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
  friendCodesIndexes: `
    CREATE INDEX friend_codes_system_id_idx ON friend_codes (system_id)
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
  frontingSessionsIndexes: `
    CREATE INDEX fronting_sessions_system_start_idx ON fronting_sessions (system_id, start_time);
    CREATE INDEX fronting_sessions_system_end_idx ON fronting_sessions (system_id, end_time)
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
  switchesIndexes: `
    CREATE INDEX switches_system_timestamp_idx ON switches (system_id, timestamp)
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
  customFrontsIndexes: `
    CREATE INDEX custom_fronts_system_id_idx ON custom_fronts (system_id)
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
  frontingCommentsIndexes: `
    CREATE INDEX fronting_comments_session_created_idx ON fronting_comments (session_id, created_at)
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
  relationshipsIndexes: `
    CREATE INDEX relationships_system_id_idx ON relationships (system_id)
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
  subsystemsIndexes: `
    CREATE INDEX subsystems_system_id_idx ON subsystems (system_id)
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
  sideSystemsIndexes: `
    CREATE INDEX side_systems_system_id_idx ON side_systems (system_id)
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
  layersIndexes: `
    CREATE INDEX layers_system_id_idx ON layers (system_id)
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
  subsystemMembershipsIndexes: `
    CREATE INDEX subsystem_memberships_subsystem_id_idx ON subsystem_memberships (subsystem_id);
    CREATE INDEX subsystem_memberships_system_id_idx ON subsystem_memberships (system_id)
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
  sideSystemMembershipsIndexes: `
    CREATE INDEX side_system_memberships_side_system_id_idx ON side_system_memberships (side_system_id);
    CREATE INDEX side_system_memberships_system_id_idx ON side_system_memberships (system_id)
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
  layerMembershipsIndexes: `
    CREATE INDEX layer_memberships_layer_id_idx ON layer_memberships (layer_id);
    CREATE INDEX layer_memberships_system_id_idx ON layer_memberships (system_id)
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
  subsystemLayerLinksIndexes: `
    CREATE INDEX subsystem_layer_links_subsystem_id_idx ON subsystem_layer_links (subsystem_id);
    CREATE INDEX subsystem_layer_links_layer_id_idx ON subsystem_layer_links (layer_id)
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
  subsystemSideSystemLinksIndexes: `
    CREATE INDEX subsystem_side_system_links_subsystem_id_idx ON subsystem_side_system_links (subsystem_id);
    CREATE INDEX subsystem_side_system_links_side_system_id_idx ON subsystem_side_system_links (side_system_id)
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
  sideSystemLayerLinksIndexes: `
    CREATE INDEX side_system_layer_links_side_system_id_idx ON side_system_layer_links (side_system_id);
    CREATE INDEX side_system_layer_links_layer_id_idx ON side_system_layer_links (layer_id)
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
  fieldDefinitionsIndexes: `
    CREATE INDEX field_definitions_system_id_idx ON field_definitions (system_id)
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
  fieldValuesIndexes: `
    CREATE INDEX field_values_definition_system_idx ON field_values (field_definition_id, system_id)
  `,
  fieldBucketVisibility: `
    CREATE TABLE field_bucket_visibility (
      field_definition_id VARCHAR(255) NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
      bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      PRIMARY KEY (field_definition_id, bucket_id)
    )
  `,
} as const;

async function pgExec(client: PGlite, sql: string): Promise<void> {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

async function createPgBaseTables(client: PGlite): Promise<void> {
  await pgExec(client, PG_DDL.accounts);
  await pgExec(client, PG_DDL.systems);
  await pgExec(client, PG_DDL.systemsIndexes);
}

export async function pgInsertAccount(
  db: PgliteDatabase<Record<string, unknown>>,
  id?: string,
): Promise<string> {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(accounts).values({
    id: resolvedId,
    emailHash: `hash_${crypto.randomUUID()}`,
    emailSalt: `salt_${crypto.randomUUID()}`,
    passwordHash: `$argon2id$${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertSystem(
  db: PgliteDatabase<Record<string, unknown>>,
  accountId: string,
  id?: string,
): Promise<string> {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(systems).values({
    id: resolvedId,
    accountId,
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function createPgAuthTables(client: PGlite): Promise<void> {
  await pgExec(client, PG_DDL.accounts);
  await pgExec(client, PG_DDL.authKeys);
  await pgExec(client, PG_DDL.sessions);
  await pgExec(client, PG_DDL.sessionsIndexes);
  await pgExec(client, PG_DDL.recoveryKeys);
  await pgExec(client, PG_DDL.deviceTransferRequests);
  await pgExec(client, PG_DDL.deviceTransferRequestsIndexes);
}

export async function createPgSystemTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
}

export async function createPgMemberTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.memberPhotos);
}

export async function createPgPrivacyTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.bucketsIndexes);
  await pgExec(client, PG_DDL.bucketContentTags);
  await pgExec(client, PG_DDL.bucketContentTagsIndexes);
  await pgExec(client, PG_DDL.keyGrants);
  await pgExec(client, PG_DDL.keyGrantsIndexes);
  await pgExec(client, PG_DDL.friendConnections);
  await pgExec(client, PG_DDL.friendConnectionsIndexes);
  await pgExec(client, PG_DDL.friendCodes);
  await pgExec(client, PG_DDL.friendCodesIndexes);
  await pgExec(client, PG_DDL.friendBucketAssignments);
}

export async function createPgFrontingTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.switches);
  await pgExec(client, PG_DDL.switchesIndexes);
  await pgExec(client, PG_DDL.customFronts);
  await pgExec(client, PG_DDL.customFrontsIndexes);
  await pgExec(client, PG_DDL.frontingComments);
  await pgExec(client, PG_DDL.frontingCommentsIndexes);
}

export async function createPgStructureTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.relationships);
  await pgExec(client, PG_DDL.relationshipsIndexes);
  await pgExec(client, PG_DDL.subsystems);
  await pgExec(client, PG_DDL.subsystemsIndexes);
  await pgExec(client, PG_DDL.sideSystems);
  await pgExec(client, PG_DDL.sideSystemsIndexes);
  await pgExec(client, PG_DDL.layers);
  await pgExec(client, PG_DDL.layersIndexes);
  await pgExec(client, PG_DDL.subsystemMemberships);
  await pgExec(client, PG_DDL.subsystemMembershipsIndexes);
  await pgExec(client, PG_DDL.sideSystemMemberships);
  await pgExec(client, PG_DDL.sideSystemMembershipsIndexes);
  await pgExec(client, PG_DDL.layerMemberships);
  await pgExec(client, PG_DDL.layerMembershipsIndexes);
  await pgExec(client, PG_DDL.subsystemLayerLinks);
  await pgExec(client, PG_DDL.subsystemLayerLinksIndexes);
  await pgExec(client, PG_DDL.subsystemSideSystemLinks);
  await pgExec(client, PG_DDL.subsystemSideSystemLinksIndexes);
  await pgExec(client, PG_DDL.sideSystemLayerLinks);
  await pgExec(client, PG_DDL.sideSystemLayerLinksIndexes);
}

export async function createPgCustomFieldsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.bucketsIndexes);
  await pgExec(client, PG_DDL.fieldDefinitions);
  await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
  await pgExec(client, PG_DDL.fieldValues);
  await pgExec(client, PG_DDL.fieldValuesIndexes);
  await pgExec(client, PG_DDL.fieldBucketVisibility);
}
