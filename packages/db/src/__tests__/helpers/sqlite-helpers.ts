/**
 * Hand-written DDL for SQLite integration tests.
 * These must be manually synchronized with schema changes in src/schema/sqlite/.
 */

import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";

import { accounts } from "../../schema/sqlite/auth.js";
import { channels, polls } from "../../schema/sqlite/communication.js";
import { members } from "../../schema/sqlite/members.js";
import { systems } from "../../schema/sqlite/systems.js";

import type { BucketId, EncryptedBlob } from "@pluralscape/types";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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

export const MS_PER_DAY = 86_400_000;
export const TTL_RETENTION_DAYS = 30;

export const SQLITE_DDL = {
  accounts: `
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL UNIQUE,
      email_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      kdf_salt TEXT NOT NULL,
      encrypted_master_key BLOB,
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
  // Privacy
  buckets: `
    CREATE TABLE buckets (
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
  bucketsIndexes: `
    CREATE INDEX buckets_system_archived_idx ON buckets (system_id, archived)
  `,
  bucketContentTags: `
    CREATE TABLE bucket_content_tags (
      entity_type TEXT NOT NULL CHECK (entity_type IS NULL OR entity_type IN ('member', 'group', 'channel', 'message', 'note', 'poll', 'relationship', 'structure-entity-type', 'structure-entity', 'journal-entry', 'wiki-page', 'custom-front', 'fronting-session', 'board-message', 'acknowledgement', 'innerworld-entity', 'innerworld-region', 'field-definition', 'field-value', 'member-photo', 'fronting-comment')),
      entity_id TEXT NOT NULL,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      PRIMARY KEY (entity_type, entity_id, bucket_id)
    )
  `,
  bucketContentTagsIndexes: `
    CREATE INDEX bucket_content_tags_bucket_id_idx ON bucket_content_tags (bucket_id);
    CREATE INDEX bucket_content_tags_system_id_idx ON bucket_content_tags (system_id)
  `,
  keyGrants: `
    CREATE TABLE key_grants (
      id TEXT PRIMARY KEY,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      friend_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_key BLOB NOT NULL,
      key_version INTEGER NOT NULL CHECK (key_version >= 1),
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      UNIQUE (bucket_id, friend_account_id, key_version)
    )
  `,
  keyGrantsIndexes: `
    CREATE INDEX key_grants_system_id_idx ON key_grants (system_id);
    CREATE INDEX key_grants_friend_bucket_idx ON key_grants (friend_account_id, bucket_id);
    CREATE INDEX key_grants_revoked_at_idx ON key_grants (revoked_at)
  `,
  friendConnections: `
    CREATE TABLE friend_connections (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      friend_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'removed')),
      encrypted_data BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, account_id),
      CHECK (account_id != friend_account_id),
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  friendConnectionsIndexes: `
    CREATE INDEX friend_connections_account_status_idx ON friend_connections (account_id, status);
    CREATE INDEX friend_connections_friend_status_idx ON friend_connections (friend_account_id, status);
    CREATE INDEX friend_connections_account_archived_idx ON friend_connections (account_id, archived);
    CREATE UNIQUE INDEX friend_connections_account_friend_uniq ON friend_connections (account_id, friend_account_id) WHERE archived = 0
  `,
  friendCodes: `
    CREATE TABLE friend_codes (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (expires_at IS NULL OR expires_at > created_at),
      CHECK (length(code) >= 8),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  friendCodesIndexes: `
    CREATE INDEX friend_codes_account_archived_idx ON friend_codes (account_id, archived);
    CREATE UNIQUE INDEX friend_codes_code_uniq ON friend_codes (code) WHERE archived = 0
  `,
  friendBucketAssignments: `
    CREATE TABLE friend_bucket_assignments (
      friend_connection_id TEXT NOT NULL REFERENCES friend_connections(id) ON DELETE CASCADE,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      PRIMARY KEY (friend_connection_id, bucket_id)
    )
  `,
  friendBucketAssignmentsIndexes: `
    CREATE INDEX friend_bucket_assignments_bucket_id_idx ON friend_bucket_assignments (bucket_id);
    CREATE INDEX friend_bucket_assignments_system_id_idx ON friend_bucket_assignments (system_id)
  `,
  // Fronting
  frontingSessions: `
    CREATE TABLE fronting_sessions (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      member_id TEXT,
      custom_front_id TEXT,
      structure_entity_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (end_time IS NULL OR end_time > start_time),
      UNIQUE (id, system_id),
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (custom_front_id) REFERENCES custom_fronts(id) ON DELETE RESTRICT,
      FOREIGN KEY (structure_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      CHECK (version >= 1),
      CHECK (member_id IS NOT NULL OR custom_front_id IS NOT NULL OR structure_entity_id IS NOT NULL),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  frontingSessionsIndexes: `
    CREATE INDEX fronting_sessions_system_start_idx ON fronting_sessions (system_id, start_time);
    CREATE INDEX fronting_sessions_system_member_start_idx ON fronting_sessions (system_id, member_id, start_time);
    CREATE INDEX fronting_sessions_system_end_idx ON fronting_sessions (system_id, end_time);
    CREATE INDEX fronting_sessions_active_idx ON fronting_sessions (system_id) WHERE end_time IS NULL;
    CREATE INDEX fronting_sessions_system_archived_idx ON fronting_sessions (system_id, archived);
    CREATE INDEX fronting_sessions_system_entity_start_idx ON fronting_sessions (system_id, structure_entity_id, start_time)
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
      archived_at INTEGER,
      UNIQUE (id, system_id),
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  customFrontsIndexes: `
    CREATE INDEX custom_fronts_system_archived_idx ON custom_fronts (system_id, archived)
  `,
  frontingComments: `
    CREATE TABLE fronting_comments (
      id TEXT PRIMARY KEY,
      fronting_session_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      member_id TEXT,
      custom_front_id TEXT,
      structure_entity_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (fronting_session_id, system_id) REFERENCES fronting_sessions(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (custom_front_id) REFERENCES custom_fronts(id) ON DELETE RESTRICT,
      FOREIGN KEY (structure_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL)),
      CHECK (member_id IS NOT NULL OR custom_front_id IS NOT NULL OR structure_entity_id IS NOT NULL)
    )
  `,
  frontingCommentsIndexes: `
    CREATE INDEX fronting_comments_session_created_idx ON fronting_comments (fronting_session_id, created_at);
    CREATE INDEX fronting_comments_system_archived_idx ON fronting_comments (system_id, archived)
  `,
  // Structure
  relationships: `
    CREATE TABLE relationships (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      source_member_id TEXT,
      target_member_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('split-from', 'fused-from', 'sibling', 'partner', 'parent-child', 'protector-of', 'caretaker-of', 'gatekeeper-of', 'source', 'custom')),
      bidirectional INTEGER NOT NULL DEFAULT 0,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (source_member_id) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (target_member_id) REFERENCES members(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  relationshipsIndexes: `
    CREATE INDEX relationships_system_archived_idx ON relationships (system_id, archived)
  `,
  systemStructureEntityTypes: `
    CREATE TABLE system_structure_entity_types (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
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
  systemStructureEntityTypesIndexes: `
    CREATE INDEX system_structure_entity_types_system_archived_idx ON system_structure_entity_types (system_id, archived)
  `,
  systemStructureEntities: `
    CREATE TABLE system_structure_entities (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (entity_type_id, system_id) REFERENCES system_structure_entity_types(id, system_id) ON DELETE RESTRICT,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  systemStructureEntitiesIndexes: `
    CREATE INDEX system_structure_entities_system_archived_idx ON system_structure_entities (system_id, archived);
    CREATE INDEX system_structure_entities_entity_type_id_idx ON system_structure_entities (system_id, entity_type_id)
  `,
  systemStructureEntityLinks: `
    CREATE TABLE system_structure_entity_links (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL,
      parent_entity_id TEXT,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (entity_id, parent_entity_id),
      FOREIGN KEY (entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (parent_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT
    )
  `,
  systemStructureEntityLinksIndexes: `
    CREATE INDEX system_structure_entity_links_entity_id_idx ON system_structure_entity_links (entity_id);
    CREATE INDEX system_structure_entity_links_parent_entity_id_idx ON system_structure_entity_links (parent_entity_id);
    CREATE INDEX system_structure_entity_links_system_id_idx ON system_structure_entity_links (system_id);
    CREATE UNIQUE INDEX system_structure_entity_links_entity_root_uniq ON system_structure_entity_links (entity_id) WHERE parent_entity_id IS NULL
  `,
  systemStructureEntityMemberLinks: `
    CREATE TABLE system_structure_entity_member_links (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_entity_id TEXT,
      member_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (member_id, parent_entity_id),
      FOREIGN KEY (parent_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE RESTRICT
    )
  `,
  systemStructureEntityMemberLinksIndexes: `
    CREATE INDEX system_structure_entity_member_links_parent_entity_id_idx ON system_structure_entity_member_links (parent_entity_id);
    CREATE INDEX system_structure_entity_member_links_member_id_idx ON system_structure_entity_member_links (member_id);
    CREATE INDEX system_structure_entity_member_links_system_id_idx ON system_structure_entity_member_links (system_id);
    CREATE UNIQUE INDEX system_structure_entity_member_links_member_root_uniq ON system_structure_entity_member_links (member_id) WHERE parent_entity_id IS NULL
  `,
  systemStructureEntityAssociations: `
    CREATE TABLE system_structure_entity_associations (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (source_entity_id, target_entity_id),
      FOREIGN KEY (source_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (target_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      CHECK (source_entity_id <> target_entity_id)
    )
  `,
  systemStructureEntityAssociationsIndexes: `
    CREATE INDEX system_structure_entity_associations_source_idx ON system_structure_entity_associations (source_entity_id);
    CREATE INDEX system_structure_entity_associations_target_idx ON system_structure_entity_associations (target_entity_id);
    CREATE INDEX system_structure_entity_associations_system_id_idx ON system_structure_entity_associations (system_id)
  `,
  // Custom Fields
  fieldDefinitions: `
    CREATE TABLE field_definitions (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'color', 'select', 'multi-select', 'url')),
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
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
  fieldDefinitionsIndexes: `
    CREATE INDEX field_definitions_system_archived_idx ON field_definitions (system_id, archived)
  `,
  fieldValues: `
    CREATE TABLE field_values (
      id TEXT PRIMARY KEY,
      field_definition_id TEXT NOT NULL,
      member_id TEXT,
      structure_entity_id TEXT,
      group_id TEXT,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (field_definition_id, system_id) REFERENCES field_definitions(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (structure_entity_id, system_id) REFERENCES system_structure_entities(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (group_id, system_id) REFERENCES groups(id, system_id) ON DELETE RESTRICT,
      CHECK (version >= 1),
      CHECK ((CASE WHEN member_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN structure_entity_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN group_id IS NOT NULL THEN 1 ELSE 0 END) <= 1)
    )
  `,
  fieldValuesIndexes: `
    CREATE INDEX field_values_definition_system_idx ON field_values (field_definition_id, system_id);
    CREATE INDEX field_values_system_member_idx ON field_values (system_id, member_id);
    CREATE INDEX field_values_system_entity_idx ON field_values (system_id, structure_entity_id);
    CREATE INDEX field_values_system_group_idx ON field_values (system_id, group_id);
    CREATE UNIQUE INDEX field_values_definition_member_uniq ON field_values (field_definition_id, member_id) WHERE member_id IS NOT NULL;
    CREATE UNIQUE INDEX field_values_definition_entity_uniq ON field_values (field_definition_id, structure_entity_id) WHERE structure_entity_id IS NOT NULL;
    CREATE UNIQUE INDEX field_values_definition_group_uniq ON field_values (field_definition_id, group_id) WHERE group_id IS NOT NULL;
    CREATE UNIQUE INDEX field_values_definition_system_uniq ON field_values (field_definition_id, system_id) WHERE member_id IS NULL AND structure_entity_id IS NULL AND group_id IS NULL
  `,
  fieldBucketVisibility: `
    CREATE TABLE field_bucket_visibility (
      field_definition_id TEXT NOT NULL REFERENCES field_definitions(id) ON DELETE RESTRICT,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE RESTRICT,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      PRIMARY KEY (field_definition_id, bucket_id)
    )
  `,
  fieldBucketVisibilityIndexes: `
    CREATE INDEX field_bucket_visibility_bucket_id_idx ON field_bucket_visibility (bucket_id);
    CREATE INDEX field_bucket_visibility_system_id_idx ON field_bucket_visibility (system_id)
  `,
  fieldDefinitionScopes: `
    CREATE TABLE field_definition_scopes (
      id TEXT PRIMARY KEY,
      field_definition_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_entity_type_id TEXT,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1),
      CHECK (scope_type IN ('system', 'member', 'group', 'structure-entity-type')),
      CHECK (scope_entity_type_id IS NULL OR scope_type = 'structure-entity-type'),
      UNIQUE (field_definition_id, scope_type, scope_entity_type_id),
      FOREIGN KEY (field_definition_id, system_id) REFERENCES field_definitions(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (scope_entity_type_id, system_id) REFERENCES system_structure_entity_types(id, system_id) ON DELETE RESTRICT
    )
  `,
  fieldDefinitionScopesIndexes: `
    CREATE INDEX field_definition_scopes_field_definition_id_idx ON field_definition_scopes (field_definition_id);
    CREATE INDEX field_definition_scopes_system_id_idx ON field_definition_scopes (system_id);
    CREATE UNIQUE INDEX field_definition_scopes_definition_scope_null_uniq ON field_definition_scopes (field_definition_id, scope_type) WHERE scope_entity_type_id IS NULL
  `,
  // Nomenclature Settings
  nomenclatureSettings: `
    CREATE TABLE nomenclature_settings (
      system_id TEXT PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1)
    )
  `,
  // System Settings
  systemSettings: `
    CREATE TABLE system_settings (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL UNIQUE REFERENCES systems(id) ON DELETE CASCADE,
      locale TEXT,
      pin_hash TEXT,
      biometric_enabled INTEGER NOT NULL DEFAULT 0,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1),
      CHECK (pin_hash IS NULL OR pin_hash LIKE '$argon2id$%')
    )
  `,
  // API Keys
  apiKeys: `
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      key_type TEXT NOT NULL CHECK (key_type IN ('metadata', 'crypto')),
      token_hash TEXT NOT NULL UNIQUE,
      scopes TEXT NOT NULL,
      encrypted_data BLOB NOT NULL,
      encrypted_key_material BLOB,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER,
      expires_at INTEGER,
      scoped_bucket_ids TEXT,
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
      id TEXT PRIMARY KEY,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      system_id TEXT REFERENCES systems(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown')),
      timestamp INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      actor TEXT NOT NULL,
      detail TEXT,
      CHECK (detail IS NULL OR length(detail) <= 2048)
    )
  `,
  auditLogIndexes: `
    CREATE INDEX audit_log_account_timestamp_idx ON audit_log (account_id, timestamp);
    CREATE INDEX audit_log_system_timestamp_idx ON audit_log (system_id, timestamp);
    CREATE INDEX audit_log_system_event_type_timestamp_idx ON audit_log (system_id, event_type, timestamp);
    CREATE INDEX audit_log_timestamp_idx ON audit_log (timestamp)
  `,
  // Lifecycle Events
  lifecycleEvents: `
    CREATE TABLE lifecycle_events (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('split', 'fusion', 'merge', 'unmerge', 'dormancy-start', 'dormancy-end', 'discovery', 'archival', 'subsystem-formation', 'form-change', 'name-change', 'structure-move', 'innerworld-move')),
      occurred_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      encrypted_data BLOB NOT NULL,
      plaintext_metadata TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  lifecycleEventsIndexes: `
    CREATE INDEX lifecycle_events_system_occurred_idx ON lifecycle_events (system_id, occurred_at);
    CREATE INDEX lifecycle_events_system_recorded_idx ON lifecycle_events (system_id, recorded_at);
    CREATE INDEX lifecycle_events_system_archived_idx ON lifecycle_events (system_id, archived)
  `,
  // Safe Mode Content
  safeModeContent: `
    CREATE TABLE safe_mode_content (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1)
    )
  `,
  safeModeContentIndexes: `
    CREATE INDEX safe_mode_content_system_sort_idx ON safe_mode_content (system_id, sort_order)
  `,
  // Communication
  channels: `
    CREATE TABLE channels (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('category', 'channel')),
      parent_id TEXT,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (parent_id) REFERENCES channels(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  channelsIndexes: `
    CREATE INDEX channels_system_archived_idx ON channels (system_id, archived)
  `,
  messages: `
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      reply_to_id TEXT,
      timestamp INTEGER NOT NULL,
      edited_at INTEGER,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (channel_id, system_id) REFERENCES channels(id, system_id) ON DELETE CASCADE,
      -- reply_to_id is a soft reference (no FK) for PG parity
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  messagesIndexes: `
    CREATE INDEX messages_channel_id_timestamp_idx ON messages (channel_id, timestamp);
    CREATE INDEX messages_system_archived_idx ON messages (system_id, archived);
    CREATE INDEX messages_reply_to_id_idx ON messages (reply_to_id)
  `,
  boardMessages: `
    CREATE TABLE board_messages (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      pinned INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  boardMessagesIndexes: `
    CREATE INDEX board_messages_system_archived_idx ON board_messages (system_id, archived)
  `,
  notes: `
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      author_entity_type TEXT,
      author_entity_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK ((author_entity_type IS NULL) = (author_entity_id IS NULL)),
      CHECK (author_entity_type IS NULL OR author_entity_type IN ('member', 'structure-entity')),
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  notesIndexes: `
    CREATE INDEX notes_system_archived_idx ON notes (system_id, archived);
    CREATE INDEX notes_system_author_type_archived_idx ON notes (system_id, author_entity_type, archived);
    CREATE INDEX notes_author_entity_id_idx ON notes (author_entity_id)
  `,
  polls: `
    CREATE TABLE polls (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_by_member_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('standard', 'custom')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      closed_at INTEGER,
      ends_at INTEGER,
      allow_multiple_votes INTEGER NOT NULL,
      max_votes_per_member INTEGER NOT NULL CHECK (max_votes_per_member >= 1),
      allow_abstain INTEGER NOT NULL,
      allow_veto INTEGER NOT NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  pollsIndexes: `
    CREATE INDEX polls_system_archived_idx ON polls (system_id, archived)
  `,
  pollVotes: `
    CREATE TABLE poll_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      option_id TEXT,
      voter TEXT,
      is_veto INTEGER NOT NULL DEFAULT 0,
      voted_at INTEGER,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (poll_id, system_id) REFERENCES polls(id, system_id) ON DELETE CASCADE,
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  pollVotesIndexes: `
    CREATE INDEX poll_votes_poll_id_idx ON poll_votes (poll_id);
    CREATE INDEX poll_votes_system_archived_idx ON poll_votes (system_id, archived)
  `,
  acknowledgements: `
    CREATE TABLE acknowledgements (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_by_member_id TEXT,
      confirmed INTEGER NOT NULL DEFAULT 0,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE SET NULL,
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  acknowledgementsIndexes: `
    CREATE INDEX acknowledgements_system_id_confirmed_idx ON acknowledgements (system_id, confirmed);
    CREATE INDEX acknowledgements_system_archived_idx ON acknowledgements (system_id, archived)
  `,
  // Journal
  journalEntries: `
    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      fronting_session_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (fronting_session_id) REFERENCES fronting_sessions(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  journalEntriesIndexes: `
    CREATE INDEX journal_entries_system_id_created_at_idx ON journal_entries (system_id, created_at);
    CREATE INDEX journal_entries_system_archived_idx ON journal_entries (system_id, archived);
    CREATE INDEX journal_entries_fronting_session_id_idx ON journal_entries (fronting_session_id)
  `,
  wikiPages: `
    CREATE TABLE wiki_pages (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      slug_hash TEXT NOT NULL,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL)),
      CHECK (length(slug_hash) = 64)
    )
  `,
  wikiPagesIndexes: `
    CREATE INDEX wiki_pages_system_archived_idx ON wiki_pages (system_id, archived)
  `,
  wikiPagesUniqueSlugIndex: `
    CREATE UNIQUE INDEX wiki_pages_system_id_slug_hash_idx ON wiki_pages (system_id, slug_hash) WHERE archived = 0
  `,
  // Groups
  groups: `
    CREATE TABLE groups (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_group_id TEXT,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  groupsIndexes: `
    CREATE INDEX groups_system_archived_idx ON groups (system_id, archived)
  `,
  groupMemberships: `
    CREATE TABLE group_memberships (
      group_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, member_id),
      FOREIGN KEY (group_id, system_id) REFERENCES groups(id, system_id) ON DELETE CASCADE,
      FOREIGN KEY (member_id, system_id) REFERENCES members(id, system_id) ON DELETE CASCADE
    )
  `,
  groupMembershipsIndexes: `
    CREATE INDEX group_memberships_member_id_idx ON group_memberships (member_id);
    CREATE INDEX group_memberships_system_id_idx ON group_memberships (system_id)
  `,
  // Innerworld
  innerworldRegions: `
    CREATE TABLE innerworld_regions (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      parent_region_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (parent_region_id) REFERENCES innerworld_regions(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  innerworldRegionsIndexes: `
    CREATE INDEX innerworld_regions_system_archived_idx ON innerworld_regions (system_id, archived)
  `,
  innerworldEntities: `
    CREATE TABLE innerworld_entities (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      region_id TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (region_id) REFERENCES innerworld_regions(id) ON DELETE SET NULL,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  innerworldEntitiesIndexes: `
    CREATE INDEX innerworld_entities_region_id_idx ON innerworld_entities (region_id);
    CREATE INDEX innerworld_entities_system_archived_idx ON innerworld_entities (system_id, archived)
  `,
  innerworldCanvas: `
    CREATE TABLE innerworld_canvas (
      system_id TEXT PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1)
    )
  `,
  // PK Bridge
  pkBridgeConfigs: `
    CREATE TABLE pk_bridge_configs (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      sync_direction TEXT NOT NULL CHECK (sync_direction IN ('ps-to-pk', 'pk-to-ps', 'bidirectional')),
      pk_token_encrypted BLOB NOT NULL,
      entity_mappings BLOB NOT NULL,
      error_log BLOB NOT NULL,
      last_sync_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      CHECK (version >= 1)
    )
  `,
  pkBridgeConfigsIndexes: `
    CREATE UNIQUE INDEX pk_bridge_configs_system_id_idx ON pk_bridge_configs (system_id)
  `,
  // Notifications
  deviceTokens: `
    CREATE TABLE device_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER,
      revoked_at INTEGER,
      CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web'))
    )
  `,
  deviceTokensIndexes: `
    CREATE INDEX device_tokens_account_id_idx ON device_tokens (account_id);
    CREATE INDEX device_tokens_system_id_idx ON device_tokens (system_id);
    CREATE INDEX device_tokens_revoked_at_idx ON device_tokens (revoked_at);
    CREATE UNIQUE INDEX device_tokens_token_platform_unique ON device_tokens (token, platform)
  `,
  notificationConfigs: `
    CREATE TABLE notification_configs (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      push_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (event_type IS NULL OR event_type IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  notificationConfigsIndexes: `
    CREATE UNIQUE INDEX notification_configs_system_id_event_type_idx ON notification_configs (system_id, event_type) WHERE archived = 0
  `,
  friendNotificationPreferences: `
    CREATE TABLE friend_notification_preferences (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      friend_connection_id TEXT NOT NULL,
      enabled_event_types TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (friend_connection_id, account_id) REFERENCES friend_connections(id, account_id) ON DELETE CASCADE,
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  friendNotificationPreferencesIndexes: `
    CREATE UNIQUE INDEX friend_notification_prefs_account_id_friend_connection_id_idx ON friend_notification_preferences (account_id, friend_connection_id) WHERE archived = 0
  `,
  // Snapshots
  systemSnapshots: `
    CREATE TABLE system_snapshots (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      snapshot_trigger TEXT NOT NULL CHECK (snapshot_trigger IN ('manual', 'scheduled-daily', 'scheduled-weekly')),
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  systemSnapshotsIndexes: `
    CREATE INDEX system_snapshots_system_created_idx ON system_snapshots (system_id, created_at)
  `,
  // Webhooks
  webhookConfigs: `
    CREATE TABLE webhook_configs (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret BLOB NOT NULL,
      event_types TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      crypto_key_id TEXT REFERENCES api_keys(id) ON DELETE RESTRICT,
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
  webhookConfigsIndexes: `
    CREATE INDEX webhook_configs_system_archived_idx ON webhook_configs (system_id, archived)
  `,
  webhookDeliveries: `
    CREATE TABLE webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      http_status INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      next_retry_at INTEGER,
      encrypted_data BLOB,
      payload_data TEXT,
      created_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (webhook_id, system_id) REFERENCES webhook_configs(id, system_id) ON DELETE RESTRICT,
      CHECK (event_type IS NULL OR event_type IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'group.created', 'group.updated', 'note.created', 'note.updated', 'chat.message-sent', 'poll.created', 'poll.closed', 'acknowledgement.requested', 'lifecycle.event-recorded', 'custom-front.changed')),
      CHECK (status IS NULL OR status IN ('pending', 'success', 'failed')),
      CHECK (attempt_count >= 0),
      CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  webhookDeliveriesIndexes: `
    CREATE INDEX webhook_deliveries_webhook_id_idx ON webhook_deliveries (webhook_id);
    CREATE INDEX webhook_deliveries_system_id_idx ON webhook_deliveries (system_id);
    CREATE INDEX webhook_deliveries_status_next_retry_at_idx ON webhook_deliveries (status, next_retry_at);
    CREATE INDEX webhook_deliveries_terminal_created_at_idx ON webhook_deliveries (created_at) WHERE status IN ('success', 'failed');
    CREATE INDEX webhook_deliveries_system_retry_idx ON webhook_deliveries (system_id, status, next_retry_at) WHERE status NOT IN ('success', 'failed')
  `,
  // Blob Metadata
  blobMetadata: `
    CREATE TABLE blob_metadata (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      storage_key TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      encryption_tier INTEGER NOT NULL,
      bucket_id TEXT,
      purpose TEXT NOT NULL,
      thumbnail_of_blob_id TEXT,
      checksum TEXT,
      created_at INTEGER NOT NULL,
      uploaded_at INTEGER,
      expires_at INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE RESTRICT,
      FOREIGN KEY (thumbnail_of_blob_id) REFERENCES blob_metadata(id) ON DELETE RESTRICT,
      CHECK (purpose IS NULL OR purpose IN ('avatar', 'member-photo', 'journal-image', 'attachment', 'export', 'littles-safe-mode')),
      CHECK (size_bytes > 0),
      CHECK (size_bytes <= 10737418240),
      CHECK (encryption_tier IN (1, 2)),
      CHECK (checksum IS NULL OR length(checksum) = 64),
      CHECK ((checksum IS NULL) = (uploaded_at IS NULL)),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  blobMetadataIndexes: `
    CREATE INDEX blob_metadata_system_id_purpose_idx ON blob_metadata (system_id, purpose);
    CREATE INDEX blob_metadata_system_archived_idx ON blob_metadata (system_id, archived);
    CREATE UNIQUE INDEX blob_metadata_storage_key_idx ON blob_metadata (storage_key)
  `,
  // Timers
  timerConfigs: `
    CREATE TABLE timer_configs (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      interval_minutes INTEGER,
      waking_hours_only INTEGER,
      waking_start TEXT,
      waking_end TEXT,
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      UNIQUE (id, system_id),
      CHECK (version >= 1),
      CHECK (waking_start IS NULL OR (
        length(waking_start) = 5
        AND substr(waking_start, 3, 1) = ':'
        AND substr(waking_start, 1, 1) BETWEEN '0' AND '2'
        AND substr(waking_start, 2, 1) BETWEEN '0' AND '9'
        AND (substr(waking_start, 1, 1) < '2' OR substr(waking_start, 2, 1) <= '3')
        AND substr(waking_start, 4, 1) BETWEEN '0' AND '5'
        AND substr(waking_start, 5, 1) BETWEEN '0' AND '9'
      )),
      CHECK (waking_end IS NULL OR (
        length(waking_end) = 5
        AND substr(waking_end, 3, 1) = ':'
        AND substr(waking_end, 1, 1) BETWEEN '0' AND '2'
        AND substr(waking_end, 2, 1) BETWEEN '0' AND '9'
        AND (substr(waking_end, 1, 1) < '2' OR substr(waking_end, 2, 1) <= '3')
        AND substr(waking_end, 4, 1) BETWEEN '0' AND '5'
        AND substr(waking_end, 5, 1) BETWEEN '0' AND '9'
      )),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  timerConfigsIndexes: `
    CREATE INDEX timer_configs_system_archived_idx ON timer_configs (system_id, archived)
  `,
  checkInRecords: `
    CREATE TABLE check_in_records (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      timer_config_id TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      responded_at INTEGER,
      dismissed INTEGER NOT NULL DEFAULT 0,
      responded_by_member_id TEXT,
      encrypted_data BLOB,
      idempotency_key TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (timer_config_id, system_id) REFERENCES timer_configs(id, system_id) ON DELETE RESTRICT,
      FOREIGN KEY (responded_by_member_id, system_id) REFERENCES members(id, system_id) ON DELETE RESTRICT,
      UNIQUE (idempotency_key),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  checkInRecordsIndexes: `
    CREATE INDEX check_in_records_system_id_idx ON check_in_records (system_id);
    CREATE INDEX check_in_records_timer_config_id_idx ON check_in_records (timer_config_id);
    CREATE INDEX check_in_records_scheduled_at_idx ON check_in_records (scheduled_at);
    CREATE INDEX check_in_records_system_pending_idx ON check_in_records (system_id, scheduled_at) WHERE responded_at IS NULL AND dismissed = 0 AND archived = 0
  `,
  // Import/Export
  importJobs: `
    CREATE TABLE import_jobs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('simply-plural', 'pluralkit', 'pluralscape')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'importing', 'completed', 'failed')),
      progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
      error_log TEXT,
      warning_count INTEGER NOT NULL DEFAULT 0,
      chunks_total INTEGER,
      chunks_completed INTEGER NOT NULL DEFAULT 0 CHECK (chunks_total IS NULL OR chunks_completed <= chunks_total),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      CHECK (error_log IS NULL OR json_array_length(error_log) <= 1000)
    )
  `,
  importJobsIndexes: `
    CREATE INDEX import_jobs_account_id_status_idx ON import_jobs (account_id, status);
    CREATE INDEX import_jobs_system_id_idx ON import_jobs (system_id)
  `,
  exportRequests: `
    CREATE TABLE export_requests (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      format TEXT NOT NULL CHECK (format IN ('json', 'csv')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      blob_id TEXT REFERENCES blob_metadata(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `,
  exportRequestsIndexes: `
    CREATE INDEX export_requests_account_id_idx ON export_requests (account_id);
    CREATE INDEX export_requests_system_id_idx ON export_requests (system_id)
  `,
  accountPurgeRequests: `
    CREATE TABLE account_purge_requests (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
      confirmation_phrase TEXT NOT NULL,
      scheduled_purge_at INTEGER NOT NULL,
      requested_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      completed_at INTEGER,
      cancelled_at INTEGER
    )
  `,
  accountPurgeRequestsIndexes: `
    CREATE INDEX account_purge_requests_account_id_idx ON account_purge_requests (account_id);
    CREATE UNIQUE INDEX account_purge_requests_active_unique_idx ON account_purge_requests (account_id) WHERE status IN ('pending', 'confirmed', 'processing')
  `,
  // Sync
  syncDocuments: `
    CREATE TABLE IF NOT EXISTS sync_documents (
      document_id TEXT PRIMARY KEY NOT NULL,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      snapshot_version INTEGER NOT NULL DEFAULT 0,
      last_seq INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      time_period TEXT,
      key_type TEXT NOT NULL DEFAULT 'derived',
      bucket_id TEXT,
      channel_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (doc_type IS NULL OR doc_type IN ('system-core', 'fronting', 'chat', 'journal', 'privacy-config', 'bucket')),
      CHECK (key_type IS NULL OR key_type IN ('derived', 'bucket')),
      CHECK (size_bytes >= 0),
      CHECK (snapshot_version >= 0),
      CHECK (last_seq >= 0)
    )
  `,
  syncDocumentsIndexes: `
    CREATE INDEX IF NOT EXISTS sync_documents_system_id_idx ON sync_documents(system_id);
    CREATE INDEX IF NOT EXISTS sync_documents_system_id_doc_type_idx ON sync_documents(system_id, doc_type)
  `,
  syncChanges: `
    CREATE TABLE IF NOT EXISTS sync_changes (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL REFERENCES sync_documents(document_id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      encrypted_payload BLOB NOT NULL,
      author_public_key BLOB NOT NULL,
      nonce BLOB NOT NULL,
      signature BLOB NOT NULL,
      created_at INTEGER NOT NULL
    )
  `,
  syncChangesIndexes: `
    CREATE UNIQUE INDEX IF NOT EXISTS sync_changes_document_id_seq_idx ON sync_changes(document_id, seq);
    CREATE UNIQUE INDEX IF NOT EXISTS sync_changes_dedup_idx ON sync_changes(document_id, author_public_key, nonce)
  `,
  syncSnapshots: `
    CREATE TABLE IF NOT EXISTS sync_snapshots (
      document_id TEXT PRIMARY KEY NOT NULL REFERENCES sync_documents(document_id) ON DELETE CASCADE,
      snapshot_version INTEGER NOT NULL,
      encrypted_payload BLOB NOT NULL,
      author_public_key BLOB NOT NULL,
      nonce BLOB NOT NULL,
      signature BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      CHECK (snapshot_version >= 0)
    )
  `,
  syncSnapshotsIndexes: ``,
  // Jobs (SQLite-only)
  jobs: `
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      system_id TEXT REFERENCES systems(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('sync-push', 'sync-pull', 'blob-upload', 'blob-cleanup', 'export-generate', 'import-process', 'webhook-deliver', 'notification-send', 'analytics-compute', 'account-purge', 'bucket-key-rotation', 'report-generate', 'audit-log-cleanup', 'partition-maintenance')),
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'dead-letter')),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      next_retry_at INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      idempotency_key TEXT,
      last_heartbeat_at INTEGER,
      timeout_ms INTEGER NOT NULL DEFAULT 30000,
      result TEXT,
      scheduled_for INTEGER,
      priority INTEGER NOT NULL DEFAULT 0,
      CHECK (attempts <= max_attempts),
      CHECK (timeout_ms > 0)
    )
  `,
  jobsIndexes: `
    CREATE INDEX jobs_status_next_retry_at_idx ON jobs (status, next_retry_at);
    CREATE INDEX jobs_type_idx ON jobs (type);
    CREATE UNIQUE INDEX jobs_idempotency_key_idx ON jobs (idempotency_key);
    CREATE INDEX jobs_priority_status_scheduled_idx ON jobs (priority, status, scheduled_for);
    CREATE INDEX jobs_heartbeat_idx ON jobs (status, last_heartbeat_at)
  `,
  bucketKeyRotations: `
    CREATE TABLE bucket_key_rotations (
      id TEXT PRIMARY KEY,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      from_key_version INTEGER NOT NULL,
      to_key_version INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'initiated' CHECK (state IN ('initiated', 'migrating', 'sealing', 'completed', 'failed')),
      initiated_at INTEGER NOT NULL,
      completed_at INTEGER,
      total_items INTEGER NOT NULL,
      completed_items INTEGER NOT NULL DEFAULT 0,
      failed_items INTEGER NOT NULL DEFAULT 0,
      CHECK (to_key_version > from_key_version),
      CHECK (completed_items + failed_items <= total_items)
    )
  `,
  bucketKeyRotationsIndexes: `
    CREATE INDEX bucket_key_rotations_bucket_state_idx ON bucket_key_rotations (bucket_id, state);
    CREATE INDEX bucket_key_rotations_system_id_idx ON bucket_key_rotations (system_id)
  `,
  bucketRotationItems: `
    CREATE TABLE bucket_rotation_items (
      id TEXT PRIMARY KEY,
      rotation_id TEXT NOT NULL REFERENCES bucket_key_rotations(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
      claimed_by TEXT,
      claimed_at INTEGER,
      completed_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `,
  bucketRotationItemsIndexes: `
    CREATE INDEX bucket_rotation_items_rotation_status_idx ON bucket_rotation_items (rotation_id, status);
    CREATE INDEX bucket_rotation_items_status_claimed_by_idx ON bucket_rotation_items (status, claimed_by);
    CREATE INDEX bucket_rotation_items_system_id_idx ON bucket_rotation_items (system_id)
  `,
  // Analytics
  frontingReports: `
    CREATE TABLE fronting_reports (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      format TEXT NOT NULL CHECK (format IN ('html', 'pdf')),
      generated_at INTEGER NOT NULL
    )
  `,
  frontingReportsIndexes: `
    CREATE INDEX fronting_reports_system_id_idx ON fronting_reports (system_id)
  `,
} as const;

function createSqliteBaseTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.systems);
  client.exec(SQLITE_DDL.systemsIndexes);
}

export function sqliteInsertAccount(
  db: BetterSQLite3Database<Record<string, unknown>>,
  id?: string,
): string {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  db.insert(accounts)
    .values({
      id: resolvedId,
      emailHash: `hash_${crypto.randomUUID()}`,
      emailSalt: `salt_${crypto.randomUUID()}`,
      passwordHash: `$argon2id$${crypto.randomUUID()}`,
      kdfSalt: `kdf_${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function sqliteInsertSystem(
  db: BetterSQLite3Database<Record<string, unknown>>,
  accountId: string,
  id?: string,
): string {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  db.insert(systems)
    .values({
      id: resolvedId,
      accountId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function createSqliteAuthTables(client: InstanceType<typeof Database>): void {
  client.exec(SQLITE_DDL.accounts);
  client.exec(SQLITE_DDL.authKeys);
  client.exec(SQLITE_DDL.sessions);
  client.exec(SQLITE_DDL.sessionsIndexes);
  client.exec(SQLITE_DDL.recoveryKeys);
  client.exec(SQLITE_DDL.recoveryKeysIndexes);
  client.exec(SQLITE_DDL.deviceTransferRequests);
  client.exec(SQLITE_DDL.deviceTransferRequestsIndexes);
}

export function createSqliteSystemTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
}

export function createSqliteMemberTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.memberPhotos);
  client.exec(SQLITE_DDL.memberPhotosIndexes);
}

export function createSqlitePrivacyTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.bucketsIndexes);
  client.exec(SQLITE_DDL.bucketContentTags);
  client.exec(SQLITE_DDL.bucketContentTagsIndexes);
  client.exec(SQLITE_DDL.keyGrants);
  client.exec(SQLITE_DDL.keyGrantsIndexes);
  client.exec(SQLITE_DDL.friendConnections);
  client.exec(SQLITE_DDL.friendConnectionsIndexes);
  client.exec(SQLITE_DDL.friendCodes);
  client.exec(SQLITE_DDL.friendCodesIndexes);
  client.exec(SQLITE_DDL.friendBucketAssignments);
  client.exec(SQLITE_DDL.friendBucketAssignmentsIndexes);
}

export function createSqliteFrontingTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityTypes);
  client.exec(SQLITE_DDL.systemStructureEntityTypesIndexes);
  client.exec(SQLITE_DDL.systemStructureEntities);
  client.exec(SQLITE_DDL.systemStructureEntitiesIndexes);
  client.exec(SQLITE_DDL.customFronts);
  client.exec(SQLITE_DDL.customFrontsIndexes);
  client.exec(SQLITE_DDL.frontingSessions);
  client.exec(SQLITE_DDL.frontingSessionsIndexes);
  client.exec(SQLITE_DDL.frontingComments);
  client.exec(SQLITE_DDL.frontingCommentsIndexes);
}

export function createSqliteStructureTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.relationships);
  client.exec(SQLITE_DDL.relationshipsIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityTypes);
  client.exec(SQLITE_DDL.systemStructureEntityTypesIndexes);
  client.exec(SQLITE_DDL.systemStructureEntities);
  client.exec(SQLITE_DDL.systemStructureEntitiesIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityLinks);
  client.exec(SQLITE_DDL.systemStructureEntityLinksIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityMemberLinks);
  client.exec(SQLITE_DDL.systemStructureEntityMemberLinksIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityAssociations);
  client.exec(SQLITE_DDL.systemStructureEntityAssociationsIndexes);
}

export function createSqliteCustomFieldsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityTypes);
  client.exec(SQLITE_DDL.systemStructureEntityTypesIndexes);
  client.exec(SQLITE_DDL.systemStructureEntities);
  client.exec(SQLITE_DDL.systemStructureEntitiesIndexes);
  client.exec(SQLITE_DDL.groups);
  client.exec(SQLITE_DDL.groupsIndexes);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.bucketsIndexes);
  client.exec(SQLITE_DDL.fieldDefinitions);
  client.exec(SQLITE_DDL.fieldDefinitionsIndexes);
  client.exec(SQLITE_DDL.fieldDefinitionScopes);
  client.exec(SQLITE_DDL.fieldDefinitionScopesIndexes);
  client.exec(SQLITE_DDL.fieldValues);
  client.exec(SQLITE_DDL.fieldValuesIndexes);
  client.exec(SQLITE_DDL.fieldBucketVisibility);
  client.exec(SQLITE_DDL.fieldBucketVisibilityIndexes);
}

export function createSqliteNomenclatureSettingsTables(
  client: InstanceType<typeof Database>,
): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.nomenclatureSettings);
}

export function createSqliteSystemSettingsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.systemSettings);
}

export function createSqliteApiKeysTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.apiKeys);
  client.exec(SQLITE_DDL.apiKeysIndexes);
}

export function createSqliteAuditLogTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.auditLog);
  client.exec(SQLITE_DDL.auditLogIndexes);
}

export function createSqliteLifecycleEventsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.lifecycleEvents);
  client.exec(SQLITE_DDL.lifecycleEventsIndexes);
}

export function createSqliteSafeModeContentTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.safeModeContent);
  client.exec(SQLITE_DDL.safeModeContentIndexes);
}

export function sqliteInsertMember(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  id?: string,
): string {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  db.insert(members)
    .values({
      id: resolvedId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function sqliteInsertChannel(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  opts: {
    id?: string;
    type?: "category" | "channel";
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): string {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  db.insert(channels)
    .values({
      id,
      systemId,
      type: opts.type ?? "channel",
      parentId: opts.parentId ?? null,
      sortOrder: opts.sortOrder ?? 0,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function sqliteInsertPoll(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  opts: { id?: string } = {},
): string {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  db.insert(polls)
    .values({
      id,
      systemId,
      kind: "standard",
      encryptedData: testBlob(),
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function createSqliteCommunicationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.channels);
  client.exec(SQLITE_DDL.channelsIndexes);
  client.exec(SQLITE_DDL.messages);
  client.exec(SQLITE_DDL.messagesIndexes);
  client.exec(SQLITE_DDL.boardMessages);
  client.exec(SQLITE_DDL.boardMessagesIndexes);
  client.exec(SQLITE_DDL.notes);
  client.exec(SQLITE_DDL.notesIndexes);
  client.exec(SQLITE_DDL.polls);
  client.exec(SQLITE_DDL.pollsIndexes);
  client.exec(SQLITE_DDL.pollVotes);
  client.exec(SQLITE_DDL.pollVotesIndexes);
  client.exec(SQLITE_DDL.acknowledgements);
  client.exec(SQLITE_DDL.acknowledgementsIndexes);
}

export function createSqliteJournalTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.systemStructureEntityTypes);
  client.exec(SQLITE_DDL.systemStructureEntityTypesIndexes);
  client.exec(SQLITE_DDL.systemStructureEntities);
  client.exec(SQLITE_DDL.systemStructureEntitiesIndexes);
  client.exec(SQLITE_DDL.customFronts);
  client.exec(SQLITE_DDL.customFrontsIndexes);
  client.exec(SQLITE_DDL.frontingSessions);
  client.exec(SQLITE_DDL.frontingSessionsIndexes);
  client.exec(SQLITE_DDL.journalEntries);
  client.exec(SQLITE_DDL.journalEntriesIndexes);
  client.exec(SQLITE_DDL.wikiPages);
  client.exec(SQLITE_DDL.wikiPagesIndexes);
  client.exec(SQLITE_DDL.wikiPagesUniqueSlugIndex);
}

export function createSqliteGroupsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.groups);
  client.exec(SQLITE_DDL.groupsIndexes);
  client.exec(SQLITE_DDL.groupMemberships);
  client.exec(SQLITE_DDL.groupMembershipsIndexes);
}

export function createSqliteInnerworldTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.innerworldRegions);
  client.exec(SQLITE_DDL.innerworldRegionsIndexes);
  client.exec(SQLITE_DDL.innerworldEntities);
  client.exec(SQLITE_DDL.innerworldEntitiesIndexes);
  client.exec(SQLITE_DDL.innerworldCanvas);
}

export function createSqlitePkBridgeTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.pkBridgeConfigs);
  client.exec(SQLITE_DDL.pkBridgeConfigsIndexes);
}

export function createSqliteSnapshotTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.systemSnapshots);
  client.exec(SQLITE_DDL.systemSnapshotsIndexes);
}

export function createSqliteNotificationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.friendConnections);
  client.exec(SQLITE_DDL.friendConnectionsIndexes);
  client.exec(SQLITE_DDL.deviceTokens);
  client.exec(SQLITE_DDL.deviceTokensIndexes);
  client.exec(SQLITE_DDL.notificationConfigs);
  client.exec(SQLITE_DDL.notificationConfigsIndexes);
  client.exec(SQLITE_DDL.friendNotificationPreferences);
  client.exec(SQLITE_DDL.friendNotificationPreferencesIndexes);
}

export function createSqliteWebhookTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.apiKeys);
  client.exec(SQLITE_DDL.apiKeysIndexes);
  client.exec(SQLITE_DDL.webhookConfigs);
  client.exec(SQLITE_DDL.webhookConfigsIndexes);
  client.exec(SQLITE_DDL.webhookDeliveries);
  client.exec(SQLITE_DDL.webhookDeliveriesIndexes);
}

export function createSqliteBlobMetadataTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.blobMetadata);
  client.exec(SQLITE_DDL.blobMetadataIndexes);
}

export function createSqliteTimerTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.members);
  client.exec(SQLITE_DDL.membersIndexes);
  client.exec(SQLITE_DDL.timerConfigs);
  client.exec(SQLITE_DDL.timerConfigsIndexes);
  client.exec(SQLITE_DDL.checkInRecords);
  client.exec(SQLITE_DDL.checkInRecordsIndexes);
}

export function createSqliteImportExportTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.blobMetadata);
  client.exec(SQLITE_DDL.blobMetadataIndexes);
  client.exec(SQLITE_DDL.importJobs);
  client.exec(SQLITE_DDL.importJobsIndexes);
  client.exec(SQLITE_DDL.exportRequests);
  client.exec(SQLITE_DDL.exportRequestsIndexes);
  client.exec(SQLITE_DDL.accountPurgeRequests);
  client.exec(SQLITE_DDL.accountPurgeRequestsIndexes);
}

export function createSqliteSyncTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.syncDocuments);
  client.exec(SQLITE_DDL.syncDocumentsIndexes);
  client.exec(SQLITE_DDL.syncChanges);
  client.exec(SQLITE_DDL.syncChangesIndexes);
  client.exec(SQLITE_DDL.syncSnapshots);
  client.exec(SQLITE_DDL.syncSnapshotsIndexes);
}

export function createSqliteJobsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.jobs);
  client.exec(SQLITE_DDL.jobsIndexes);
}

export function createSqliteAnalyticsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.frontingReports);
  client.exec(SQLITE_DDL.frontingReportsIndexes);
}

export function createSqliteKeyRotationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(SQLITE_DDL.buckets);
  client.exec(SQLITE_DDL.bucketsIndexes);
  client.exec(SQLITE_DDL.bucketKeyRotations);
  client.exec(SQLITE_DDL.bucketKeyRotationsIndexes);
  client.exec(SQLITE_DDL.bucketRotationItems);
  client.exec(SQLITE_DDL.bucketRotationItemsIndexes);
}
