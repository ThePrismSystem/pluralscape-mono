/**
 * SQLite DDL constants — privacy, fronting, structure, and custom-fields tables.
 *
 * Covers: buckets, bucket_content_tags, key_grants, friend_connections,
 *   friend_codes, friend_bucket_assignments, fronting_sessions, custom_fronts,
 *   fronting_comments, relationships, system_structure_entity_types/entities/
 *   links/member_links/associations, field_definitions, field_values,
 *   field_bucket_visibility, field_definition_scopes.
 * Companion files: sqlite-helpers-ddl-auth-core.ts,
 *   sqlite-helpers-ddl-comm-misc.ts, sqlite-helpers-schema.ts,
 *   sqlite-helpers.ts
 */

export const SQLITE_DDL_PRIVACY_STRUCTURE = {
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
} as const;
