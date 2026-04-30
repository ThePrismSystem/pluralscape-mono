/**
 * SQLite DDL constants — operational tables: webhooks, blob metadata,
 *   timers, import/export, sync, jobs, key-rotation, and analytics.
 *
 * Covers: webhook_configs, webhook_deliveries, blob_metadata, timer_configs,
 *   check_in_records, import_jobs, import_entity_refs, export_requests,
 *   account_purge_requests, sync_documents, sync_changes, sync_snapshots,
 *   jobs, bucket_key_rotations, bucket_rotation_items, fronting_reports.
 * Companion files: sqlite-helpers-ddl-auth-core.ts,
 *   sqlite-helpers-ddl-privacy-structure.ts, sqlite-helpers-ddl-comm-journal.ts,
 *   sqlite-helpers-schema.ts, sqlite-helpers.ts
 */

export const SQLITE_DDL_OPS_MISC = {
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
      encrypted_data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (webhook_id, system_id) REFERENCES webhook_configs(id, system_id) ON DELETE RESTRICT,
      CHECK (event_type IS NULL OR event_type IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'group.created', 'group.updated', 'lifecycle.event-recorded', 'custom-front.changed', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend.connected', 'friend.removed', 'friend.bucket-assigned', 'friend.bucket-unassigned')),
      CHECK (status IS NULL OR status IN ('pending', 'success', 'failed')),
      CHECK (attempt_count >= 0),
      CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599))
    )
  `,
  webhookDeliveriesIndexes: `
    CREATE INDEX webhook_deliveries_webhook_id_idx ON webhook_deliveries (webhook_id);
    CREATE INDEX webhook_deliveries_system_id_idx ON webhook_deliveries (system_id);
    CREATE INDEX webhook_deliveries_status_next_retry_at_idx ON webhook_deliveries (status, next_retry_at);
    CREATE INDEX webhook_deliveries_terminal_created_at_idx ON webhook_deliveries (created_at) WHERE status IN ('success', 'failed');
    CREATE INDEX webhook_deliveries_system_retry_idx ON webhook_deliveries (system_id, status, next_retry_at) WHERE status NOT IN ('success', 'failed');
    CREATE INDEX webhook_deliveries_pending_retry_idx ON webhook_deliveries (next_retry_at) WHERE status = 'pending'
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
      next_check_in_at INTEGER,
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
    CREATE INDEX timer_configs_system_archived_idx ON timer_configs (system_id, archived);
    CREATE INDEX timer_configs_next_check_in_idx ON timer_configs (next_check_in_at) WHERE enabled = 1 AND archived_at IS NULL;
    CREATE INDEX timer_configs_enabled_active_idx ON timer_configs (enabled) WHERE archived_at IS NULL
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
      checkpoint_state TEXT,
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
  importEntityRefs: `
    CREATE TABLE import_entity_refs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('simply-plural', 'pluralkit', 'pluralscape')),
      source_entity_type TEXT NOT NULL CHECK (source_entity_type IN ('member', 'group', 'custom-front', 'fronting-session', 'fronting-comment', 'switch', 'custom-field', 'field-definition', 'field-value', 'note', 'journal-entry', 'chat-message', 'board-message', 'channel-category', 'channel', 'poll', 'timer', 'privacy-bucket', 'system-profile', 'system-settings', 'unknown')),
      source_entity_id TEXT NOT NULL,
      pluralscape_entity_id TEXT NOT NULL,
      imported_at INTEGER NOT NULL
    )
  `,
  importEntityRefsIndexes: `
    CREATE UNIQUE INDEX import_entity_refs_source_unique_idx ON import_entity_refs (account_id, system_id, source, source_entity_type, source_entity_id);
    CREATE INDEX import_entity_refs_pluralscape_entity_id_idx ON import_entity_refs (pluralscape_entity_id);
    CREATE INDEX import_entity_refs_account_system_idx ON import_entity_refs (account_id, system_id)
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
      generated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      CHECK (version >= 1),
      CHECK ((archived = true) = (archived_at IS NOT NULL))
    )
  `,
  frontingReportsIndexes: `
    CREATE INDEX fronting_reports_system_id_idx ON fronting_reports (system_id)
  `,
} as const;
