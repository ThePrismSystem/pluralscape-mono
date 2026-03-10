import { accounts } from "../../schema/pg/auth.js";
import { channels } from "../../schema/pg/communication.js";
import { members } from "../../schema/pg/members.js";
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
    CREATE INDEX messages_system_id_idx ON messages (system_id)
  `,
  boardMessages: `
    CREATE TABLE board_messages (
      id VARCHAR(255) PRIMARY KEY,
      system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
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
      status VARCHAR(255) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      closed_at TIMESTAMPTZ,
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
      confirmed BOOLEAN NOT NULL DEFAULT false,
      confirmed_at TIMESTAMPTZ,
      encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `,
  acknowledgementsIndexes: `
    CREATE INDEX acknowledgements_system_id_idx ON acknowledgements (system_id);
    CREATE INDEX acknowledgements_confirmed_idx ON acknowledgements (confirmed)
  `,
  // Journal
  journalEntries: `
    CREATE TABLE journal_entries (
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
  journalEntriesIndexes: `
    CREATE INDEX journal_entries_system_id_created_at_idx ON journal_entries (system_id, created_at)
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
      gatekeeper_member_ids JSONB NOT NULL,
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
      encrypted_data BYTEA NOT NULL
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
    CREATE INDEX pk_bridge_state_system_id_idx ON pk_bridge_state (system_id)
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
    encryptedData: new Uint8Array([1, 2, 3]),
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
    encryptedData: new Uint8Array([1, 2, 3]),
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
