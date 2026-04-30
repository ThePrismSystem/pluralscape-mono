/**
 * SQLite DDL constants — communication, journal, groups, innerworld,
 *   and notifications tables.
 *
 * Covers: nomenclature_settings, system_settings, api_keys, audit_log,
 *   lifecycle_events, safe_mode_content, channels, messages, board_messages,
 *   notes, polls, poll_votes, acknowledgements, journal_entries, wiki_pages,
 *   groups, group_memberships, innerworld_regions, innerworld_entities,
 *   innerworld_canvas, pk_bridge_configs, device_tokens, notification_configs,
 *   friend_notification_preferences.
 * Companion files: sqlite-helpers-ddl-auth-core.ts,
 *   sqlite-helpers-ddl-privacy-structure.ts, sqlite-helpers-ddl-ops-misc.ts,
 *   sqlite-helpers-schema.ts, sqlite-helpers.ts
 */

export const SQLITE_DDL_COMM_JOURNAL = {
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
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      FOREIGN KEY (poll_id, system_id) REFERENCES polls(id, system_id) ON DELETE CASCADE,
      CHECK ((archived = true) = (archived_at IS NOT NULL)),
      CHECK (version >= 1)
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
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
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
  // Notifications
  deviceTokens: `
    CREATE TABLE device_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      token_hash TEXT NOT NULL,
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
    CREATE UNIQUE INDEX device_tokens_token_hash_platform_unique ON device_tokens (token_hash, platform)
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
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (event_type IS NULL OR event_type IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
      CHECK ((archived = true) = (archived_at IS NOT NULL)),
      CHECK (version >= 1)
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
} as const;
