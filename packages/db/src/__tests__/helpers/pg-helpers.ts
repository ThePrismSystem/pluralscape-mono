/**
 * Hand-written DDL for PGlite integration tests.
 * These must be manually synchronized with schema changes in src/schema/pg/.
 */

import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";

import { accounts } from "../../schema/pg/auth.js";
import { channels, polls } from "../../schema/pg/communication.js";
import { members } from "../../schema/pg/members.js";
import { systems } from "../../schema/pg/systems.js";

import type { PGlite } from "@electric-sql/pglite";
import type { BucketId, EncryptedBlob } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/** Creates a minimal valid EncryptedBlob for test fixtures. */
export function testBlob(ciphertext: Uint8Array = new Uint8Array([1, 2, 3])): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xaa);
  return {
    ciphertext,
    nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
}

/** Creates a T2 EncryptedBlob with bucketId for test fixtures. */
export function testBlobT2(
  ciphertext: Uint8Array = new Uint8Array([4, 5, 6]),
  bucketId = "test-bucket" as BucketId,
): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xbb);
  return {
    ciphertext,
    nonce,
    tier: 2,
    algorithm: "xchacha20-poly1305",
    keyVersion: 1,
    bucketId,
  };
}

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
      member_id VARCHAR(255),
      fronting_type VARCHAR(255) CHECK (fronting_type IS NULL OR fronting_type IN ('fronting', 'co-conscious')),
      custom_front_id VARCHAR(255),
      linked_structure JSONB,
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
      member_id VARCHAR(255),
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
      source_member_id VARCHAR(255),
      target_member_id VARCHAR(255),
      type VARCHAR(255) CHECK (type IS NULL OR type IN ('split-from', 'fused-from', 'sibling', 'partner', 'parent-child', 'protector-of', 'caretaker-of', 'gatekeeper-of', 'source', 'custom')),
      bidirectional BOOLEAN,
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
      architecture_type JSONB,
      has_core BOOLEAN,
      discovery_status VARCHAR(255) CHECK (discovery_status IS NULL OR discovery_status IN ('fully-mapped', 'partially-mapped', 'unknown')),
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
      field_type VARCHAR(255) CHECK (field_type IS NULL OR field_type IN ('text', 'number', 'boolean', 'date', 'color', 'select', 'multi-select', 'url')),
      required BOOLEAN,
      sort_order INTEGER,
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
      member_id VARCHAR(255),
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
  // Nomenclature Settings
  nomenclatureSettings: `
    CREATE TABLE nomenclature_settings (
      system_id VARCHAR(255) PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  // System Settings
  systemSettings: `
    CREATE TABLE system_settings (
      system_id VARCHAR(255) PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      locale VARCHAR(255),
      pin_hash VARCHAR(512),
      biometric_enabled BOOLEAN NOT NULL DEFAULT false,
      littles_safe_mode_enabled BOOLEAN NOT NULL DEFAULT false,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  // API Keys
  apiKeys: `
    CREATE TABLE api_keys (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      key_type VARCHAR(255) NOT NULL CHECK (key_type IN ('metadata', 'crypto')),
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      scopes JSONB NOT NULL,
      encrypted_key_material BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      scoped_bucket_ids JSONB,
      CHECK ((key_type = 'crypto' AND encrypted_key_material IS NOT NULL) OR (key_type = 'metadata' AND encrypted_key_material IS NULL))
    )
  `,
  apiKeysIndexes: `
    CREATE INDEX api_keys_account_id_idx ON api_keys (account_id);
    CREATE INDEX api_keys_system_id_idx ON api_keys (system_id);
    CREATE INDEX api_keys_revoked_at_idx ON api_keys (revoked_at);
    CREATE INDEX api_keys_key_type_idx ON api_keys (key_type)
  `,
  // Audit Log
  auditLog: `
    CREATE TABLE audit_log (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE SET NULL,
      system_id VARCHAR(255) REFERENCES systems(id) ON DELETE SET NULL,
      event_type VARCHAR(255) NOT NULL CHECK (event_type IN ('auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown')),
      timestamp TIMESTAMPTZ NOT NULL,
      ip_address VARCHAR(255),
      user_agent VARCHAR(1024),
      actor JSONB NOT NULL,
      detail TEXT
    )
  `,
  auditLogIndexes: `
    CREATE INDEX audit_log_account_timestamp_idx ON audit_log (account_id, timestamp);
    CREATE INDEX audit_log_system_timestamp_idx ON audit_log (system_id, timestamp);
    CREATE INDEX audit_log_event_type_idx ON audit_log (event_type)
  `,
  // Lifecycle Events
  lifecycleEvents: `
    CREATE TABLE lifecycle_events (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type VARCHAR(255) CHECK (event_type IS NULL OR event_type IN ('split', 'fusion', 'merge', 'unmerge', 'dormancy-start', 'dormancy-end', 'discovery', 'archival', 'subsystem-formation', 'form-change', 'name-change')),
      occurred_at TIMESTAMPTZ NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      encrypted_data BYTEA NOT NULL
    )
  `,
  lifecycleEventsIndexes: `
    CREATE INDEX lifecycle_events_system_occurred_idx ON lifecycle_events (system_id, occurred_at);
    CREATE INDEX lifecycle_events_system_recorded_idx ON lifecycle_events (system_id, recorded_at)
  `,
  // Safe Mode Content
  safeModeContent: `
    CREATE TABLE safe_mode_content (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  safeModeContentIndexes: `
    CREATE INDEX safe_mode_content_system_sort_idx ON safe_mode_content (system_id, sort_order)
  `,
  // Communication
  channels: `
    CREATE TABLE channels (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      type VARCHAR(255) NOT NULL CHECK (type IN ('category', 'channel')),
      parent_id VARCHAR(255) REFERENCES channels(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  channelsIndexes: `
    CREATE INDEX channels_system_id_idx ON channels (system_id)
  `,
  messages: `
    CREATE TABLE messages (
      id VARCHAR(255) PRIMARY KEY,
      channel_id VARCHAR(255) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sender_id VARCHAR(255) NOT NULL,
      reply_to_id VARCHAR(255) REFERENCES messages(id) ON DELETE SET NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      edited_at TIMESTAMPTZ,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  messagesIndexes: `
    CREATE INDEX messages_channel_id_timestamp_idx ON messages (channel_id, timestamp);
    CREATE INDEX messages_system_id_idx ON messages (system_id);
    CREATE INDEX messages_reply_to_id_idx ON messages (reply_to_id)
  `,
  boardMessages: `
    CREATE TABLE board_messages (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sender_id VARCHAR(255),
      pinned BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  boardMessagesIndexes: `
    CREATE INDEX board_messages_system_id_idx ON board_messages (system_id)
  `,
  notes: `
    CREATE TABLE notes (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      member_id VARCHAR(255) REFERENCES members(id) ON DELETE SET NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  notesIndexes: `
    CREATE INDEX notes_system_id_idx ON notes (system_id);
    CREATE INDEX notes_member_id_idx ON notes (member_id)
  `,
  polls: `
    CREATE TABLE polls (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_by_member_id VARCHAR(255),
      kind VARCHAR(255) CHECK (kind IS NULL OR kind IN ('standard', 'custom')),
      status VARCHAR(255) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      closed_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      allow_multiple_votes BOOLEAN NOT NULL,
      max_votes_per_member INTEGER NOT NULL CHECK (max_votes_per_member >= 1),
      allow_abstain BOOLEAN NOT NULL,
      allow_veto BOOLEAN NOT NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  pollsIndexes: `
    CREATE INDEX polls_system_id_idx ON polls (system_id)
  `,
  pollVotes: `
    CREATE TABLE poll_votes (
      id VARCHAR(255) PRIMARY KEY,
      poll_id VARCHAR(255) NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      option_id VARCHAR(255),
      voter JSONB,
      is_veto BOOLEAN,
      voted_at TIMESTAMPTZ,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  pollVotesIndexes: `
    CREATE INDEX poll_votes_poll_id_idx ON poll_votes (poll_id);
    CREATE INDEX poll_votes_system_id_idx ON poll_votes (system_id)
  `,
  acknowledgements: `
    CREATE TABLE acknowledgements (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_by_member_id VARCHAR(255),
      target_member_id VARCHAR(255),
      confirmed BOOLEAN NOT NULL DEFAULT false,
      confirmed_at TIMESTAMPTZ,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  acknowledgementsIndexes: `
    CREATE INDEX acknowledgements_system_id_idx ON acknowledgements (system_id);
    CREATE INDEX acknowledgements_confirmed_idx ON acknowledgements (confirmed);
    CREATE INDEX acknowledgements_target_member_id_idx ON acknowledgements (target_member_id)
  `,
  // Journal
  journalEntries: `
    CREATE TABLE journal_entries (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      fronting_session_id VARCHAR(255) REFERENCES fronting_sessions(id) ON DELETE SET NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  journalEntriesIndexes: `
    CREATE INDEX journal_entries_system_id_created_at_idx ON journal_entries (system_id, created_at);
    CREATE INDEX journal_entries_fronting_session_id_idx ON journal_entries (fronting_session_id)
  `,
  wikiPages: `
    CREATE TABLE wiki_pages (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      slug VARCHAR(255) NOT NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `,
  wikiPagesIndexes: `
    CREATE INDEX wiki_pages_system_id_idx ON wiki_pages (system_id)
  `,
  wikiPagesUniqueSlugIndex: `
    CREATE UNIQUE INDEX wiki_pages_system_id_slug_idx ON wiki_pages (system_id, slug)
  `,
  // Groups
  groups: `
    CREATE TABLE groups (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_group_id VARCHAR(255),
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ,
      FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE SET NULL
    )
  `,
  groupsIndexes: `
    CREATE INDEX groups_system_id_idx ON groups (system_id)
  `,
  groupMemberships: `
    CREATE TABLE group_memberships (
      group_id VARCHAR(255) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      member_id VARCHAR(255) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (group_id, member_id)
    )
  `,
  groupMembershipsIndexes: `
    CREATE INDEX group_memberships_member_id_idx ON group_memberships (member_id);
    CREATE INDEX group_memberships_system_id_idx ON group_memberships (system_id)
  `,
  // Innerworld
  innerworldRegions: `
    CREATE TABLE innerworld_regions (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_region_id VARCHAR(255),
      access_type VARCHAR(255) NOT NULL CHECK (access_type IN ('open', 'gatekept')),
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (parent_region_id) REFERENCES innerworld_regions(id) ON DELETE SET NULL
    )
  `,
  innerworldRegionsIndexes: `
    CREATE INDEX innerworld_regions_system_id_idx ON innerworld_regions (system_id)
  `,
  innerworldEntities: `
    CREATE TABLE innerworld_entities (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type VARCHAR(255) NOT NULL CHECK (entity_type IN ('member', 'landmark', 'subsystem', 'side-system', 'layer')),
      region_id VARCHAR(255) REFERENCES innerworld_regions(id) ON DELETE SET NULL,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  innerworldEntitiesIndexes: `
    CREATE INDEX innerworld_entities_system_id_idx ON innerworld_entities (system_id);
    CREATE INDEX innerworld_entities_region_id_idx ON innerworld_entities (region_id)
  `,
  innerworldCanvas: `
    CREATE TABLE innerworld_canvas (
      system_id VARCHAR(255) PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  // PK Bridge
  pkBridgeState: `
    CREATE TABLE pk_bridge_state (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT true,
      sync_direction VARCHAR(255) NOT NULL CHECK (sync_direction IN ('ps-to-pk', 'pk-to-ps', 'bidirectional')),
      pk_token_encrypted BYTEA NOT NULL,
      entity_mappings BYTEA NOT NULL,
      error_log BYTEA NOT NULL,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  pkBridgeStateIndexes: `
    CREATE UNIQUE INDEX pk_bridge_state_system_id_idx ON pk_bridge_state (system_id)
  `,
  // Notifications
  deviceTokens: `
    CREATE TABLE device_tokens (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      platform VARCHAR(255) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
      token VARCHAR(512) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `,
  deviceTokensIndexes: `
    CREATE INDEX device_tokens_account_id_idx ON device_tokens (account_id);
    CREATE INDEX device_tokens_system_id_idx ON device_tokens (system_id);
    CREATE INDEX device_tokens_revoked_at_idx ON device_tokens (revoked_at)
  `,
  notificationConfigs: `
    CREATE TABLE notification_configs (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type VARCHAR(255) NOT NULL CHECK (event_type IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
      enabled BOOLEAN NOT NULL DEFAULT true,
      push_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `,
  notificationConfigsIndexes: `
    CREATE UNIQUE INDEX notification_configs_system_id_event_type_idx ON notification_configs (system_id, event_type)
  `,
  friendNotificationPreferences: `
    CREATE TABLE friend_notification_preferences (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      friend_connection_id VARCHAR(255) NOT NULL REFERENCES friend_connections(id) ON DELETE CASCADE,
      enabled_event_types JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `,
  friendNotificationPreferencesIndexes: `
    CREATE UNIQUE INDEX friend_notification_prefs_system_id_friend_connection_id_idx ON friend_notification_preferences (system_id, friend_connection_id)
  `,
  // Webhooks
  webhookConfigs: `
    CREATE TABLE webhook_configs (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      url VARCHAR(2048) NOT NULL,
      secret BYTEA NOT NULL,
      event_types JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      crypto_key_id VARCHAR(255) REFERENCES api_keys(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `,
  webhookConfigsIndexes: `
    CREATE INDEX webhook_configs_system_id_idx ON webhook_configs (system_id)
  `,
  webhookDeliveries: `
    CREATE TABLE webhook_deliveries (
      id VARCHAR(255) PRIMARY KEY,
      webhook_id VARCHAR(255) NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type VARCHAR(255) NOT NULL CHECK (event_type IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'switch.recorded', 'group.created', 'group.updated', 'note.created', 'note.updated', 'chat.message-sent', 'poll.created', 'poll.closed', 'acknowledgement.requested', 'lifecycle.event-recorded', 'custom-front.changed')),
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
      http_status INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      next_retry_at TIMESTAMPTZ,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      CHECK (attempt_count >= 0),
      CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599))
    )
  `,
  webhookDeliveriesIndexes: `
    CREATE INDEX webhook_deliveries_webhook_id_idx ON webhook_deliveries (webhook_id);
    CREATE INDEX webhook_deliveries_system_id_idx ON webhook_deliveries (system_id);
    CREATE INDEX webhook_deliveries_status_next_retry_at_idx ON webhook_deliveries (status, next_retry_at)
  `,
  // Blob Metadata
  blobMetadata: `
    CREATE TABLE blob_metadata (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      storage_key VARCHAR(1024) NOT NULL,
      mime_type VARCHAR(255),
      size_bytes BIGINT NOT NULL,
      encryption_tier INTEGER NOT NULL,
      bucket_id VARCHAR(255) REFERENCES buckets(id) ON DELETE SET NULL,
      purpose VARCHAR(255) NOT NULL CHECK (purpose IN ('avatar', 'member-photo', 'journal-image', 'attachment', 'export', 'littles-safe-mode')),
      thumbnail_of_blob_id VARCHAR(255),
      checksum VARCHAR(255),
      uploaded_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY (thumbnail_of_blob_id) REFERENCES blob_metadata(id) ON DELETE SET NULL,
      CHECK (size_bytes > 0),
      CHECK (encryption_tier IN (1, 2))
    )
  `,
  blobMetadataIndexes: `
    CREATE INDEX blob_metadata_system_id_idx ON blob_metadata (system_id);
    CREATE UNIQUE INDEX blob_metadata_storage_key_idx ON blob_metadata (storage_key)
  `,
  // Timers
  timerConfigs: `
    CREATE TABLE timer_configs (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT true,
      interval_minutes INTEGER,
      waking_hours_only BOOLEAN,
      waking_start VARCHAR(255),
      waking_end VARCHAR(255),
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `,
  timerConfigsIndexes: `
    CREATE INDEX timer_configs_system_id_idx ON timer_configs (system_id)
  `,
  checkInRecords: `
    CREATE TABLE check_in_records (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      timer_config_id VARCHAR(255) NOT NULL REFERENCES timer_configs(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      responded_at TIMESTAMPTZ,
      dismissed BOOLEAN NOT NULL DEFAULT false,
      responded_by_member_id VARCHAR(255),
      encrypted_data BYTEA
    )
  `,
  checkInRecordsIndexes: `
    CREATE INDEX check_in_records_system_id_idx ON check_in_records (system_id);
    CREATE INDEX check_in_records_timer_config_id_idx ON check_in_records (timer_config_id);
    CREATE INDEX check_in_records_scheduled_at_idx ON check_in_records (scheduled_at)
  `,
  // Import/Export
  importJobs: `
    CREATE TABLE import_jobs (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      source VARCHAR(255) NOT NULL CHECK (source IN ('simply-plural', 'pluralkit', 'pluralscape')),
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'importing', 'completed', 'failed')),
      progress_percent INTEGER NOT NULL DEFAULT 0,
      error_log JSONB,
      warning_count INTEGER NOT NULL DEFAULT 0,
      chunks_total INTEGER,
      chunks_completed INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      CHECK (progress_percent >= 0 AND progress_percent <= 100),
      CHECK (chunks_total IS NULL OR chunks_completed <= chunks_total)
    )
  `,
  importJobsIndexes: `
    CREATE INDEX import_jobs_account_id_status_idx ON import_jobs (account_id, status);
    CREATE INDEX import_jobs_system_id_idx ON import_jobs (system_id)
  `,
  exportRequests: `
    CREATE TABLE export_requests (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      format VARCHAR(255) NOT NULL CHECK (format IN ('json', 'csv')),
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      blob_id VARCHAR(255) REFERENCES blob_metadata(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `,
  exportRequestsIndexes: `
    CREATE INDEX export_requests_account_id_idx ON export_requests (account_id);
    CREATE INDEX export_requests_system_id_idx ON export_requests (system_id)
  `,
  accountPurgeRequests: `
    CREATE TABLE account_purge_requests (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      status VARCHAR(255) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
      confirmation_phrase VARCHAR(255) NOT NULL,
      scheduled_purge_at TIMESTAMPTZ NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL,
      confirmed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ
    )
  `,
  accountPurgeRequestsIndexes: `
    CREATE INDEX account_purge_requests_account_id_idx ON account_purge_requests (account_id);
    CREATE UNIQUE INDEX account_purge_requests_pending_unique_idx ON account_purge_requests (account_id) WHERE status = 'pending'
  `,
  // Sync
  syncDocuments: `
    CREATE TABLE sync_documents (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type VARCHAR(255) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      automerge_heads BYTEA,
      version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at TIMESTAMPTZ NOT NULL,
      last_synced_at TIMESTAMPTZ
    )
  `,
  syncDocumentsIndexes: `
    CREATE UNIQUE INDEX sync_documents_system_id_entity_type_entity_id_idx ON sync_documents (system_id, entity_type, entity_id)
  `,
  syncQueue: `
    CREATE TABLE sync_queue (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type VARCHAR(255) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      operation VARCHAR(255) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
      change_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      synced_at TIMESTAMPTZ
    )
  `,
  syncQueueIndexes: `
    CREATE INDEX sync_queue_system_id_synced_at_idx ON sync_queue (system_id, synced_at);
    CREATE INDEX sync_queue_unsynced_idx ON sync_queue (system_id) WHERE synced_at IS NULL
  `,
  syncConflicts: `
    CREATE TABLE sync_conflicts (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type VARCHAR(255) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      local_version INTEGER NOT NULL,
      remote_version INTEGER NOT NULL,
      resolution VARCHAR(255) CHECK (resolution IN ('local', 'remote', 'merged')),
      created_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ,
      details TEXT
    )
  `,
  syncConflictsIndexes: `
    CREATE INDEX sync_conflicts_system_id_entity_type_entity_id_idx ON sync_conflicts (system_id, entity_type, entity_id)
  `,
} as const;

export async function pgExec(client: PGlite, sql: string): Promise<void> {
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

export async function createPgNomenclatureSettingsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.nomenclatureSettings);
}

export async function createPgSystemSettingsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.systemSettings);
}

export async function createPgApiKeysTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
}

export async function createPgAuditLogTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.auditLog);
  await pgExec(client, PG_DDL.auditLogIndexes);
}

export async function createPgLifecycleEventsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.lifecycleEvents);
  await pgExec(client, PG_DDL.lifecycleEventsIndexes);
}

export async function createPgSafeModeContentTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.safeModeContent);
  await pgExec(client, PG_DDL.safeModeContentIndexes);
}

export async function pgInsertMember(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  id?: string,
): Promise<string> {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(members).values({
    id: resolvedId,
    systemId,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertChannel(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: {
    id?: string;
    type?: "category" | "channel";
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): Promise<string> {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(channels).values({
    id,
    systemId,
    type: opts.type ?? "channel",
    parentId: opts.parentId ?? null,
    sortOrder: opts.sortOrder ?? 0,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function pgInsertPoll(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: { id?: string } = {},
): Promise<string> {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(polls).values({
    id,
    systemId,
    encryptedData: testBlob(),
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function createPgCommunicationTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.channels);
  await pgExec(client, PG_DDL.channelsIndexes);
  await pgExec(client, PG_DDL.messages);
  await pgExec(client, PG_DDL.messagesIndexes);
  await pgExec(client, PG_DDL.boardMessages);
  await pgExec(client, PG_DDL.boardMessagesIndexes);
  await pgExec(client, PG_DDL.notes);
  await pgExec(client, PG_DDL.notesIndexes);
  await pgExec(client, PG_DDL.polls);
  await pgExec(client, PG_DDL.pollsIndexes);
  await pgExec(client, PG_DDL.pollVotes);
  await pgExec(client, PG_DDL.pollVotesIndexes);
  await pgExec(client, PG_DDL.acknowledgements);
  await pgExec(client, PG_DDL.acknowledgementsIndexes);
}

export async function createPgJournalTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.journalEntries);
  await pgExec(client, PG_DDL.journalEntriesIndexes);
  await pgExec(client, PG_DDL.wikiPages);
  await pgExec(client, PG_DDL.wikiPagesIndexes);
  await pgExec(client, PG_DDL.wikiPagesUniqueSlugIndex);
}

export async function createPgGroupsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.groups);
  await pgExec(client, PG_DDL.groupsIndexes);
  await pgExec(client, PG_DDL.groupMemberships);
  await pgExec(client, PG_DDL.groupMembershipsIndexes);
}

export async function createPgInnerworldTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.innerworldRegions);
  await pgExec(client, PG_DDL.innerworldRegionsIndexes);
  await pgExec(client, PG_DDL.innerworldEntities);
  await pgExec(client, PG_DDL.innerworldEntitiesIndexes);
  await pgExec(client, PG_DDL.innerworldCanvas);
}

export async function createPgPkBridgeTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.pkBridgeState);
  await pgExec(client, PG_DDL.pkBridgeStateIndexes);
}

export async function createPgNotificationTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.friendConnections);
  await pgExec(client, PG_DDL.friendConnectionsIndexes);
  await pgExec(client, PG_DDL.deviceTokens);
  await pgExec(client, PG_DDL.deviceTokensIndexes);
  await pgExec(client, PG_DDL.notificationConfigs);
  await pgExec(client, PG_DDL.notificationConfigsIndexes);
  await pgExec(client, PG_DDL.friendNotificationPreferences);
  await pgExec(client, PG_DDL.friendNotificationPreferencesIndexes);
}

export async function createPgWebhookTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
  await pgExec(client, PG_DDL.webhookConfigs);
  await pgExec(client, PG_DDL.webhookConfigsIndexes);
  await pgExec(client, PG_DDL.webhookDeliveries);
  await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
}

export async function createPgBlobMetadataTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.blobMetadata);
  await pgExec(client, PG_DDL.blobMetadataIndexes);
}

export async function createPgTimerTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.timerConfigs);
  await pgExec(client, PG_DDL.timerConfigsIndexes);
  await pgExec(client, PG_DDL.checkInRecords);
  await pgExec(client, PG_DDL.checkInRecordsIndexes);
}

export async function createPgImportExportTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.blobMetadata);
  await pgExec(client, PG_DDL.blobMetadataIndexes);
  await pgExec(client, PG_DDL.importJobs);
  await pgExec(client, PG_DDL.importJobsIndexes);
  await pgExec(client, PG_DDL.exportRequests);
  await pgExec(client, PG_DDL.exportRequestsIndexes);
  await pgExec(client, PG_DDL.accountPurgeRequests);
  await pgExec(client, PG_DDL.accountPurgeRequestsIndexes);
}

export async function createPgSyncTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.syncDocuments);
  await pgExec(client, PG_DDL.syncDocumentsIndexes);
  await pgExec(client, PG_DDL.syncQueue);
  await pgExec(client, PG_DDL.syncQueueIndexes);
  await pgExec(client, PG_DDL.syncConflicts);
  await pgExec(client, PG_DDL.syncConflictsIndexes);
}
