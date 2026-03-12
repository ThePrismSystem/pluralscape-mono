-- Part 1: Enable pgcrypto extension (db-kj3j)
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

-- Part 2: VARCHAR length normalization (ID_MAX_LENGTH 255 -> 50, ENUM_MAX_LENGTH 255 -> 50)
-- Pre-release: no production data, all existing values fit within 50 chars.
ALTER TABLE "account_purge_requests" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "account_purge_requests" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "account_purge_requests" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "account_purge_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "acknowledgements" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "acknowledgements" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "acknowledgements" ALTER COLUMN "created_by_member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "key_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "auth_keys" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "auth_keys" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "auth_keys" ALTER COLUMN "key_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blob_metadata" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blob_metadata" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blob_metadata" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blob_metadata" ALTER COLUMN "purpose" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "blob_metadata" ALTER COLUMN "thumbnail_of_blob_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "board_messages" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "board_messages" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ALTER COLUMN "entity_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ALTER COLUMN "state" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ALTER COLUMN "state" SET DEFAULT 'initiated';--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "rotation_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "entity_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "buckets" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "buckets" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "parent_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "check_in_records" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "check_in_records" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "check_in_records" ALTER COLUMN "timer_config_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "check_in_records" ALTER COLUMN "responded_by_member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "custom_fronts" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "custom_fronts" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_tokens" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_tokens" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_tokens" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_tokens" ALTER COLUMN "platform" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "source_session_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "target_session_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "format" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "export_requests" ALTER COLUMN "blob_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ALTER COLUMN "field_definition_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "field_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_values" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_values" ALTER COLUMN "field_definition_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_values" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "field_values" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ALTER COLUMN "friend_connection_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_codes" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_codes" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_connections" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_connections" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_connections" ALTER COLUMN "friend_system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_connections" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_connections" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "friend_notification_preferences" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_notification_preferences" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "friend_notification_preferences" ALTER COLUMN "friend_connection_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_comments" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_comments" ALTER COLUMN "fronting_session_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_comments" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_comments" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_reports" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_reports" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_reports" ALTER COLUMN "format" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "fronting_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "custom_front_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "group_memberships" ALTER COLUMN "group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "group_memberships" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "group_memberships" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "parent_group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "source" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "import_jobs" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "innerworld_canvas" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_entities" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_entities" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_entities" ALTER COLUMN "region_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_regions" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_regions" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "innerworld_regions" ALTER COLUMN "parent_region_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "fronting_session_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "key_grants" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "key_grants" ALTER COLUMN "bucket_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "key_grants" ALTER COLUMN "friend_system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "layer_memberships" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "layer_memberships" ALTER COLUMN "layer_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "layer_memberships" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lifecycle_events" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lifecycle_events" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lifecycle_events" ALTER COLUMN "event_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "member_photos" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "member_photos" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "member_photos" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "channel_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "reply_to_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "nomenclature_settings" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notification_configs" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notification_configs" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "notification_configs" ALTER COLUMN "event_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "pk_bridge_state" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "pk_bridge_state" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "pk_bridge_state" ALTER COLUMN "sync_direction" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "poll_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "option_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "created_by_member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "kind" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "recovery_keys" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "recovery_keys" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "source_member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "target_member_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "safe_mode_content" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "safe_mode_content" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ALTER COLUMN "side_system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ALTER COLUMN "layer_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_memberships" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_memberships" ALTER COLUMN "side_system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_system_memberships" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_systems" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "side_systems" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ALTER COLUMN "subsystem_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ALTER COLUMN "layer_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ALTER COLUMN "subsystem_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ALTER COLUMN "subsystem_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ALTER COLUMN "side_system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "parent_subsystem_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "discovery_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "switches" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "switches" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_conflicts" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_conflicts" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_conflicts" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_conflicts" ALTER COLUMN "entity_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_conflicts" ALTER COLUMN "resolution" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_documents" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_documents" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_documents" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_documents" ALTER COLUMN "entity_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_queue" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_queue" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_queue" ALTER COLUMN "entity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_queue" ALTER COLUMN "entity_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_queue" ALTER COLUMN "operation" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "account_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "timer_configs" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "timer_configs" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_configs" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_configs" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_configs" ALTER COLUMN "crypto_key_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "webhook_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "event_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "wiki_pages" ALTER COLUMN "id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "wiki_pages" ALTER COLUMN "system_id" SET DATA TYPE varchar(50);--> statement-breakpoint

-- Part 3: Additional CHECK constraints from schema hardening
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_error_log_length_check" CHECK ("import_jobs"."error_log" IS NULL OR jsonb_array_length("import_jobs"."error_log") <= 1000);--> statement-breakpoint
ALTER TABLE "sync_documents" ADD CONSTRAINT "sync_documents_automerge_heads_size_check" CHECK ("sync_documents"."automerge_heads" IS NULL OR octet_length("sync_documents"."automerge_heads") <= 16384);--> statement-breakpoint

-- Part 4: Audit log partitioning (db-ahn1)
-- Pre-release: no production data, so we DROP and recreate with PARTITION BY RANGE.
-- Drizzle cannot express partitioning; this is the only hand-edited section.

-- Drop dependent objects first
DROP INDEX IF EXISTS "audit_log_account_timestamp_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_log_system_timestamp_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_log_event_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_log_timestamp_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "audit_log";--> statement-breakpoint

-- Recreate with composite PK and range partitioning
CREATE TABLE "audit_log" (
    "id" varchar(50) NOT NULL,
    "account_id" varchar(50) REFERENCES "accounts"("id") ON DELETE SET NULL,
    "system_id" varchar(50) REFERENCES "systems"("id") ON DELETE SET NULL,
    -- Authoritative enum source: AUDIT_EVENT_TYPES in packages/db/src/helpers/enums.ts
    "event_type" varchar(50) NOT NULL CHECK (event_type IN ('auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown')),
    "timestamp" timestamptz NOT NULL,
    "ip_address" varchar(255),
    "user_agent" varchar(1024),
    "actor" jsonb NOT NULL,
    "detail" text,
    PRIMARY KEY ("id", "timestamp")
) PARTITION BY RANGE ("timestamp");--> statement-breakpoint

-- Indexes on partitioned table
CREATE INDEX "audit_log_account_timestamp_idx" ON "audit_log" ("account_id", "timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_system_timestamp_idx" ON "audit_log" ("system_id", "timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_event_type_idx" ON "audit_log" ("event_type");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" ("timestamp");--> statement-breakpoint

-- Initial monthly partitions (2026-01 through 2026-06) + default
-- New partitions should be created by a scheduled job before each month begins.
CREATE TABLE "audit_log_2026_01" PARTITION OF "audit_log" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');--> statement-breakpoint
CREATE TABLE "audit_log_2026_02" PARTITION OF "audit_log" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');--> statement-breakpoint
CREATE TABLE "audit_log_2026_03" PARTITION OF "audit_log" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE "audit_log_2026_04" PARTITION OF "audit_log" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE "audit_log_2026_05" PARTITION OF "audit_log" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE "audit_log_2026_06" PARTITION OF "audit_log" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE "audit_log_default" PARTITION OF "audit_log" DEFAULT;
