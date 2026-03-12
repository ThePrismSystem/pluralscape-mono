PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`system_id` text NOT NULL,
	`reply_to_id` text,
	`timestamp` integer NOT NULL,
	`edited_at` integer,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`,`system_id`) REFERENCES `channels`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "messages_version_check" CHECK("__new_messages"."version" >= 1),
	CONSTRAINT "messages_archived_consistency_check" CHECK(("__new_messages"."archived" = true) = ("__new_messages"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "channel_id", "system_id", "reply_to_id", "timestamp", "edited_at", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "channel_id", "system_id", "reply_to_id", "timestamp", "edited_at", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_channel_id_timestamp_idx` ON `messages` (`channel_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `messages_system_id_idx` ON `messages` (`system_id`);--> statement-breakpoint
CREATE INDEX `messages_reply_to_id_idx` ON `messages` (`reply_to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_system_id_unique` ON `messages` (`id`,`system_id`);--> statement-breakpoint
DROP INDEX `account_purge_requests_pending_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `account_purge_requests_active_unique_idx` ON `account_purge_requests` (`account_id`) WHERE status IN ('pending', 'confirmed', 'processing');--> statement-breakpoint
DROP INDEX `sync_queue_seq_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `sync_queue_system_id_seq_idx` ON `sync_queue` (`system_id`,`seq`);--> statement-breakpoint
CREATE TABLE `__new_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`field_type` text,
	`required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "field_definitions_field_type_check" CHECK("__new_field_definitions"."field_type" IS NULL OR "__new_field_definitions"."field_type" IN (?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "field_definitions_version_check" CHECK("__new_field_definitions"."version" >= 1),
	CONSTRAINT "field_definitions_archived_consistency_check" CHECK(("__new_field_definitions"."archived" = true) = ("__new_field_definitions"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_field_definitions`("id", "system_id", "field_type", "required", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "field_type", "required", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `field_definitions`;--> statement-breakpoint
DROP TABLE `field_definitions`;--> statement-breakpoint
ALTER TABLE `__new_field_definitions` RENAME TO `field_definitions`;--> statement-breakpoint
CREATE INDEX `field_definitions_system_id_idx` ON `field_definitions` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `field_definitions_id_system_id_unique` ON `field_definitions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_fronting_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`member_id` text,
	`fronting_type` text DEFAULT 'fronting' NOT NULL,
	`custom_front_id` text,
	`linked_structure` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "fronting_sessions_end_time_check" CHECK("__new_fronting_sessions"."end_time" IS NULL OR "__new_fronting_sessions"."end_time" > "__new_fronting_sessions"."start_time"),
	CONSTRAINT "fronting_sessions_fronting_type_check" CHECK("__new_fronting_sessions"."fronting_type" IS NULL OR "__new_fronting_sessions"."fronting_type" IN (?, ?)),
	CONSTRAINT "fronting_sessions_version_check" CHECK("__new_fronting_sessions"."version" >= 1),
	CONSTRAINT "fronting_sessions_subject_check" CHECK("__new_fronting_sessions"."member_id" IS NOT NULL OR "__new_fronting_sessions"."custom_front_id" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_fronting_sessions`("id", "system_id", "start_time", "end_time", "member_id", "fronting_type", "custom_front_id", "linked_structure", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "start_time", "end_time", "member_id", "fronting_type", "custom_front_id", "linked_structure", "encrypted_data", "created_at", "updated_at", "version" FROM `fronting_sessions`;--> statement-breakpoint
DROP TABLE `fronting_sessions`;--> statement-breakpoint
ALTER TABLE `__new_fronting_sessions` RENAME TO `fronting_sessions`;--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_start_idx` ON `fronting_sessions` (`system_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_member_start_idx` ON `fronting_sessions` (`system_id`,`member_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_end_idx` ON `fronting_sessions` (`system_id`,`end_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_active_idx` ON `fronting_sessions` (`system_id`) WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `fronting_sessions_id_system_id_unique` ON `fronting_sessions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lifecycle_events_event_type_check" CHECK("__new_lifecycle_events"."event_type" IS NULL OR "__new_lifecycle_events"."event_type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?))
);
--> statement-breakpoint
INSERT INTO `__new_lifecycle_events`("id", "system_id", "event_type", "occurred_at", "recorded_at", "encrypted_data") SELECT "id", "system_id", "event_type", "occurred_at", "recorded_at", "encrypted_data" FROM `lifecycle_events`;--> statement-breakpoint
DROP TABLE `lifecycle_events`;--> statement-breakpoint
ALTER TABLE `__new_lifecycle_events` RENAME TO `lifecycle_events`;--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_occurred_idx` ON `lifecycle_events` (`system_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_recorded_idx` ON `lifecycle_events` (`system_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `__new_poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`system_id` text NOT NULL,
	`option_id` text,
	`voter` text,
	`is_veto` integer DEFAULT false NOT NULL,
	`voted_at` integer,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`,`system_id`) REFERENCES `polls`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_poll_votes`("id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at") SELECT "id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at" FROM `poll_votes`;--> statement-breakpoint
DROP TABLE `poll_votes`;--> statement-breakpoint
ALTER TABLE `__new_poll_votes` RENAME TO `poll_votes`;--> statement-breakpoint
CREATE INDEX `poll_votes_poll_id_idx` ON `poll_votes` (`poll_id`);--> statement-breakpoint
CREATE INDEX `poll_votes_system_id_idx` ON `poll_votes` (`system_id`);--> statement-breakpoint
CREATE TABLE `__new_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`created_by_member_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_at` integer,
	`ends_at` integer,
	`allow_multiple_votes` integer NOT NULL,
	`max_votes_per_member` integer NOT NULL,
	`allow_abstain` integer NOT NULL,
	`allow_veto` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "polls_status_check" CHECK("__new_polls"."status" IS NULL OR "__new_polls"."status" IN (?, ?)),
	CONSTRAINT "polls_kind_check" CHECK("__new_polls"."kind" IS NULL OR "__new_polls"."kind" IN (?, ?)),
	CONSTRAINT "polls_max_votes_check" CHECK("__new_polls"."max_votes_per_member" >= 1),
	CONSTRAINT "polls_version_check" CHECK("__new_polls"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_polls`("id", "system_id", "created_by_member_id", "kind", "status", "closed_at", "ends_at", "allow_multiple_votes", "max_votes_per_member", "allow_abstain", "allow_veto", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "created_by_member_id", "kind", "status", "closed_at", "ends_at", "allow_multiple_votes", "max_votes_per_member", "allow_abstain", "allow_veto", "encrypted_data", "created_at", "updated_at", "version" FROM `polls`;--> statement-breakpoint
DROP TABLE `polls`;--> statement-breakpoint
ALTER TABLE `__new_polls` RENAME TO `polls`;--> statement-breakpoint
CREATE INDEX `polls_system_id_idx` ON `polls` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `polls_id_system_id_unique` ON `polls` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`source_member_id` text,
	`target_member_id` text,
	`type` text NOT NULL,
	`bidirectional` integer DEFAULT false NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "relationships_type_check" CHECK("__new_relationships"."type" IS NULL OR "__new_relationships"."type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "relationships_version_check" CHECK("__new_relationships"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_relationships`("id", "system_id", "source_member_id", "target_member_id", "type", "bidirectional", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "source_member_id", "target_member_id", "type", "bidirectional", "encrypted_data", "created_at", "updated_at", "version" FROM `relationships`;--> statement-breakpoint
DROP TABLE `relationships`;--> statement-breakpoint
ALTER TABLE `__new_relationships` RENAME TO `relationships`;--> statement-breakpoint
CREATE INDEX `relationships_system_id_idx` ON `relationships` (`system_id`);--> statement-breakpoint
CREATE TABLE `__new_safe_mode_content` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "safe_mode_content_version_check" CHECK("__new_safe_mode_content"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_safe_mode_content`("id", "system_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version" FROM `safe_mode_content`;--> statement-breakpoint
DROP TABLE `safe_mode_content`;--> statement-breakpoint
ALTER TABLE `__new_safe_mode_content` RENAME TO `safe_mode_content`;--> statement-breakpoint
CREATE INDEX `safe_mode_content_system_sort_idx` ON `safe_mode_content` (`system_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_subsystems` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_subsystem_id` text,
	`architecture_type` text,
	`has_core` integer DEFAULT false NOT NULL,
	`discovery_status` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_subsystem_id`,`system_id`) REFERENCES `subsystems`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "subsystems_discovery_status_check" CHECK("__new_subsystems"."discovery_status" IS NULL OR "__new_subsystems"."discovery_status" IN (?, ?, ?)),
	CONSTRAINT "subsystems_version_check" CHECK("__new_subsystems"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_subsystems`("id", "system_id", "parent_subsystem_id", "architecture_type", "has_core", "discovery_status", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "parent_subsystem_id", "architecture_type", "has_core", "discovery_status", "encrypted_data", "created_at", "updated_at", "version" FROM `subsystems`;--> statement-breakpoint
DROP TABLE `subsystems`;--> statement-breakpoint
ALTER TABLE `__new_subsystems` RENAME TO `subsystems`;--> statement-breakpoint
CREATE INDEX `subsystems_system_id_idx` ON `subsystems` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subsystems_id_system_id_unique` ON `subsystems` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_blob_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer NOT NULL,
	`encryption_tier` integer NOT NULL,
	`bucket_id` text,
	`purpose` text NOT NULL,
	`thumbnail_of_blob_id` text,
	`checksum` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`thumbnail_of_blob_id`) REFERENCES `blob_metadata`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "blob_metadata_purpose_check" CHECK("__new_blob_metadata"."purpose" IS NULL OR "__new_blob_metadata"."purpose" IN (?, ?, ?, ?, ?, ?)),
	CONSTRAINT "blob_metadata_size_bytes_check" CHECK("__new_blob_metadata"."size_bytes" > 0),
	CONSTRAINT "blob_metadata_size_bytes_max_check" CHECK("__new_blob_metadata"."size_bytes" <= 10737418240),
	CONSTRAINT "blob_metadata_encryption_tier_check" CHECK("__new_blob_metadata"."encryption_tier" IN (1, 2))
);
--> statement-breakpoint
INSERT INTO `__new_blob_metadata`("id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "uploaded_at") SELECT "id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "uploaded_at" FROM `blob_metadata`;--> statement-breakpoint
DROP TABLE `blob_metadata`;--> statement-breakpoint
ALTER TABLE `__new_blob_metadata` RENAME TO `blob_metadata`;--> statement-breakpoint
CREATE INDEX `blob_metadata_system_id_purpose_idx` ON `blob_metadata` (`system_id`,`purpose`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_storage_key_idx` ON `blob_metadata` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_id_system_id_unique` ON `blob_metadata` (`id`,`system_id`);