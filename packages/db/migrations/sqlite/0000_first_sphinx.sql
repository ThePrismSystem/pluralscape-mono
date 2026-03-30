CREATE TABLE `account_purge_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirmation_phrase` text NOT NULL,
	`scheduled_purge_at` integer NOT NULL,
	`requested_at` integer NOT NULL,
	`confirmed_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "account_purge_requests_status_check" CHECK("account_purge_requests"."status" IS NULL OR "account_purge_requests"."status" IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `account_purge_requests_account_id_idx` ON `account_purge_requests` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_purge_requests_active_unique_idx` ON `account_purge_requests` (`account_id`) WHERE "account_purge_requests"."status" IN ('pending', 'confirmed', 'processing');--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_type` text DEFAULT 'system' NOT NULL,
	`email_hash` text NOT NULL,
	`email_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`kdf_salt` text NOT NULL,
	`encrypted_master_key` blob,
	`encrypted_email` blob,
	`audit_log_ip_tracking` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounts_account_type_check" CHECK("accounts"."account_type" IS NULL OR "accounts"."account_type" IN ('system', 'viewer')),
	CONSTRAINT "accounts_version_check" CHECK("accounts"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_hash_idx` ON `accounts` (`email_hash`);--> statement-breakpoint
CREATE TABLE `acknowledgements` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`created_by_member_id` text,
	`confirmed` integer DEFAULT false NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "acknowledgements_version_check" CHECK("acknowledgements"."version" >= 1),
	CONSTRAINT "acknowledgements_archived_consistency_check" CHECK(("acknowledgements"."archived" = true) = ("acknowledgements"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `acknowledgements_system_id_confirmed_idx` ON `acknowledgements` (`system_id`,`confirmed`);--> statement-breakpoint
CREATE INDEX `acknowledgements_system_archived_idx` ON `acknowledgements` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `acknowledgements_system_archived_created_idx` ON `acknowledgements` (`system_id`,`archived`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`key_type` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`encrypted_key_material` blob,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`expires_at` integer,
	`scoped_bucket_ids` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_keys_key_type_check" CHECK("api_keys"."key_type" IS NULL OR "api_keys"."key_type" IN ('metadata', 'crypto')),
	CONSTRAINT "api_keys_key_material_check" CHECK(("api_keys"."key_type" = 'crypto' AND "api_keys"."encrypted_key_material" IS NOT NULL) OR ("api_keys"."key_type" = 'metadata' AND "api_keys"."encrypted_key_material" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `api_keys_account_id_idx` ON `api_keys` (`account_id`);--> statement-breakpoint
CREATE INDEX `api_keys_system_id_idx` ON `api_keys` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_idx` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_revoked_at_idx` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `api_keys_key_type_idx` ON `api_keys` (`key_type`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text NOT NULL,
	`account_id` text,
	`system_id` text,
	`event_type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`actor` text NOT NULL,
	`detail` text,
	PRIMARY KEY(`id`, `timestamp`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_log_event_type_check" CHECK("audit_log"."event_type" IS NULL OR "audit_log"."event_type" IN ('auth.register', 'auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'api-key.created', 'api-key.revoked', 'settings.changed', 'member.created', 'member.archived', 'member.deleted', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'bucket.key_rotation.retried', 'device.security.jailbreak_warning_shown', 'auth.password-reset-via-recovery', 'auth.recovery-key-regenerated', 'auth.device-transfer-initiated', 'auth.device-transfer-completed', 'auth.device-transfer-approved', 'auth.email-changed', 'system.created', 'system.profile-updated', 'system.deleted', 'system.purged', 'system.duplicated', 'snapshot.created', 'snapshot.deleted', 'group.created', 'group.updated', 'group.archived', 'group.restored', 'group.moved', 'group-membership.added', 'group-membership.removed', 'custom-front.created', 'custom-front.updated', 'custom-front.archived', 'custom-front.restored', 'group.deleted', 'custom-front.deleted', 'auth.biometric-enrolled', 'auth.biometric-verified', 'auth.biometric-failed', 'settings.pin-set', 'settings.pin-removed', 'settings.pin-verified', 'settings.nomenclature-updated', 'setup.step-completed', 'setup.completed', 'member.updated', 'member.duplicated', 'member.restored', 'member-photo.created', 'member-photo.archived', 'member-photo.restored', 'member-photo.deleted', 'member-photo.reordered', 'field-definition.created', 'field-definition.updated', 'field-definition.archived', 'field-definition.restored', 'field-definition.deleted', 'field-value.set', 'field-value.updated', 'field-value.deleted', 'structure-entity-type.created', 'structure-entity-type.updated', 'structure-entity-type.archived', 'structure-entity-type.restored', 'structure-entity-type.deleted', 'structure-entity.created', 'structure-entity.updated', 'structure-entity.archived', 'structure-entity.restored', 'structure-entity.deleted', 'structure-entity-link.created', 'structure-entity-link.deleted', 'structure-entity-member-link.added', 'structure-entity-member-link.removed', 'structure-entity-association.created', 'structure-entity-association.deleted', 'relationship.created', 'relationship.updated', 'relationship.archived', 'relationship.restored', 'relationship.deleted', 'lifecycle-event.created', 'lifecycle-event.archived', 'lifecycle-event.restored', 'lifecycle-event.deleted', 'lifecycle-event.updated', 'timer-config.created', 'timer-config.updated', 'timer-config.archived', 'timer-config.restored', 'timer-config.deleted', 'check-in-record.created', 'check-in-record.responded', 'check-in-record.dismissed', 'check-in-record.archived', 'check-in-record.deleted', 'check-in-record.restored', 'innerworld-region.created', 'innerworld-region.updated', 'innerworld-region.archived', 'innerworld-region.restored', 'innerworld-region.deleted', 'innerworld-entity.created', 'innerworld-entity.updated', 'innerworld-entity.archived', 'innerworld-entity.restored', 'innerworld-entity.deleted', 'innerworld-canvas.created', 'innerworld-canvas.updated', 'blob.upload-requested', 'blob.confirmed', 'blob.archived', 'fronting-report.created', 'fronting-report.deleted', 'fronting-session.created', 'fronting-session.updated', 'fronting-session.ended', 'fronting-session.archived', 'fronting-session.restored', 'fronting-session.deleted', 'fronting-comment.created', 'fronting-comment.updated', 'fronting-comment.archived', 'fronting-comment.restored', 'fronting-comment.deleted', 'webhook-config.created', 'webhook-config.updated', 'webhook-config.archived', 'webhook-config.restored', 'webhook-config.deleted', 'webhook-config.secret-rotated', 'webhook-delivery.deleted', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'poll-vote.updated', 'poll-vote.archived', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend-code.generated', 'friend-code.redeemed', 'friend-code.archived', 'friend-connection.created', 'friend-connection.accepted', 'friend-connection.rejected', 'friend-connection.blocked', 'friend-connection.removed', 'friend-connection.archived', 'friend-connection.restored', 'friend-visibility.updated', 'friend-bucket-assignment.assigned', 'friend-bucket-assignment.unassigned', 'device-token.registered', 'device-token.revoked', 'device-token.updated', 'device-token.deleted', 'notification-config.updated', 'friend-notification-preference.updated')),
	CONSTRAINT "audit_log_detail_length_check" CHECK("audit_log"."detail" IS NULL OR length("audit_log"."detail") <= 2048)
);
--> statement-breakpoint
CREATE INDEX `audit_log_account_timestamp_idx` ON `audit_log` (`account_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_timestamp_idx` ON `audit_log` (`system_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_event_type_timestamp_idx` ON `audit_log` (`system_id`,`event_type`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_id_unique` ON `audit_log` (`id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `auth_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`encrypted_private_key` blob NOT NULL,
	`public_key` blob NOT NULL,
	`key_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_keys_key_type_check" CHECK("auth_keys"."key_type" IS NULL OR "auth_keys"."key_type" IN ('encryption', 'signing'))
);
--> statement-breakpoint
CREATE INDEX `auth_keys_account_id_idx` ON `auth_keys` (`account_id`);--> statement-breakpoint
CREATE TABLE `biometric_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `biometric_tokens_session_id_idx` ON `biometric_tokens` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `biometric_tokens_token_hash_idx` ON `biometric_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `biometric_tokens_unused_idx` ON `biometric_tokens` (`token_hash`) WHERE used_at IS NULL;--> statement-breakpoint
CREATE TABLE `blob_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer NOT NULL,
	`encryption_tier` integer NOT NULL,
	`bucket_id` text,
	`purpose` text NOT NULL,
	`thumbnail_of_blob_id` text,
	`checksum` text,
	`created_at` integer NOT NULL,
	`uploaded_at` integer,
	`expires_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumbnail_of_blob_id`) REFERENCES `blob_metadata`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "blob_metadata_purpose_check" CHECK("blob_metadata"."purpose" IS NULL OR "blob_metadata"."purpose" IN ('avatar', 'member-photo', 'journal-image', 'attachment', 'export', 'littles-safe-mode')),
	CONSTRAINT "blob_metadata_size_bytes_check" CHECK("blob_metadata"."size_bytes" > 0),
	CONSTRAINT "blob_metadata_size_bytes_max_check" CHECK("blob_metadata"."size_bytes" <= 10737418240),
	CONSTRAINT "blob_metadata_encryption_tier_check" CHECK("blob_metadata"."encryption_tier" IN (1, 2)),
	CONSTRAINT "blob_metadata_checksum_length_check" CHECK("blob_metadata"."checksum" IS NULL OR length("blob_metadata"."checksum") = 64),
	CONSTRAINT "blob_metadata_pending_consistency_check" CHECK(("blob_metadata"."checksum" IS NULL) = ("blob_metadata"."uploaded_at" IS NULL)),
	CONSTRAINT "blob_metadata_archived_consistency_check" CHECK(("blob_metadata"."archived" = true) = ("blob_metadata"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `blob_metadata_system_id_purpose_idx` ON `blob_metadata` (`system_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `blob_metadata_system_archived_idx` ON `blob_metadata` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_storage_key_idx` ON `blob_metadata` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_id_system_id_unique` ON `blob_metadata` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `board_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "board_messages_sort_order_check" CHECK("board_messages"."sort_order" >= 0),
	CONSTRAINT "board_messages_version_check" CHECK("board_messages"."version" >= 1),
	CONSTRAINT "board_messages_archived_consistency_check" CHECK(("board_messages"."archived" = true) = ("board_messages"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `board_messages_system_archived_idx` ON `board_messages` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `board_messages_system_archived_sort_idx` ON `board_messages` (`system_id`,`archived`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `bucket_content_tags` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `bucket_id`),
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_content_tags_entity_type_check" CHECK("bucket_content_tags"."entity_type" IS NULL OR "bucket_content_tags"."entity_type" IN ('member', 'group', 'channel', 'message', 'note', 'poll', 'relationship', 'structure-entity-type', 'structure-entity', 'journal-entry', 'wiki-page', 'custom-front', 'fronting-session', 'board-message', 'acknowledgement', 'innerworld-entity', 'innerworld-region', 'field-definition', 'field-value', 'member-photo', 'fronting-comment'))
);
--> statement-breakpoint
CREATE INDEX `bucket_content_tags_bucket_id_idx` ON `bucket_content_tags` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `bucket_content_tags_system_id_idx` ON `bucket_content_tags` (`system_id`);--> statement-breakpoint
CREATE INDEX `bucket_content_tags_system_entity_type_idx` ON `bucket_content_tags` (`system_id`,`entity_type`);--> statement-breakpoint
CREATE TABLE `bucket_key_rotations` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	`from_key_version` integer NOT NULL,
	`to_key_version` integer NOT NULL,
	`state` text DEFAULT 'initiated' NOT NULL,
	`initiated_at` integer NOT NULL,
	`completed_at` integer,
	`total_items` integer NOT NULL,
	`completed_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_key_rotations_state_check" CHECK("bucket_key_rotations"."state" IS NULL OR "bucket_key_rotations"."state" IN ('initiated', 'migrating', 'sealing', 'completed', 'failed')),
	CONSTRAINT "bucket_key_rotations_version_check" CHECK("bucket_key_rotations"."to_key_version" > "bucket_key_rotations"."from_key_version"),
	CONSTRAINT "bucket_key_rotations_items_check" CHECK("bucket_key_rotations"."completed_items" + "bucket_key_rotations"."failed_items" <= "bucket_key_rotations"."total_items")
);
--> statement-breakpoint
CREATE INDEX `bucket_key_rotations_bucket_state_idx` ON `bucket_key_rotations` (`bucket_id`,`state`);--> statement-breakpoint
CREATE INDEX `bucket_key_rotations_system_id_idx` ON `bucket_key_rotations` (`system_id`);--> statement-breakpoint
CREATE TABLE `bucket_rotation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`rotation_id` text NOT NULL,
	`system_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`claimed_by` text,
	`claimed_at` integer,
	`completed_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`rotation_id`) REFERENCES `bucket_key_rotations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_rotation_items_status_check" CHECK("bucket_rotation_items"."status" IS NULL OR "bucket_rotation_items"."status" IN ('pending', 'claimed', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `bucket_rotation_items_rotation_status_idx` ON `bucket_rotation_items` (`rotation_id`,`status`);--> statement-breakpoint
CREATE INDEX `bucket_rotation_items_status_claimed_by_idx` ON `bucket_rotation_items` (`status`,`claimed_by`);--> statement-breakpoint
CREATE INDEX `bucket_rotation_items_system_id_idx` ON `bucket_rotation_items` (`system_id`);--> statement-breakpoint
CREATE TABLE `buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "buckets_version_check" CHECK("buckets"."version" >= 1),
	CONSTRAINT "buckets_archived_consistency_check" CHECK(("buckets"."archived" = true) = ("buckets"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `buckets_system_archived_idx` ON `buckets` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `buckets_id_system_id_unique` ON `buckets` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` text,
	`sort_order` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`,`system_id`) REFERENCES `channels`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "channels_type_check" CHECK("channels"."type" IS NULL OR "channels"."type" IN ('category', 'channel')),
	CONSTRAINT "channels_sort_order_check" CHECK("channels"."sort_order" >= 0),
	CONSTRAINT "channels_version_check" CHECK("channels"."version" >= 1),
	CONSTRAINT "channels_archived_consistency_check" CHECK(("channels"."archived" = true) = ("channels"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `channels_system_archived_idx` ON `channels` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `channels_parent_id_idx` ON `channels` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `channels_id_system_id_unique` ON `channels` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `check_in_records` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`timer_config_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`responded_at` integer,
	`dismissed` integer DEFAULT false NOT NULL,
	`responded_by_member_id` text,
	`encrypted_data` blob,
	`idempotency_key` text,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`timer_config_id`,`system_id`) REFERENCES `timer_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`responded_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "check_in_records_archived_consistency_check" CHECK(("check_in_records"."archived" = true) = ("check_in_records"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `check_in_records_system_id_idx` ON `check_in_records` (`system_id`);--> statement-breakpoint
CREATE INDEX `check_in_records_timer_config_id_idx` ON `check_in_records` (`timer_config_id`);--> statement-breakpoint
CREATE INDEX `check_in_records_scheduled_at_idx` ON `check_in_records` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `check_in_records_system_pending_idx` ON `check_in_records` (`system_id`,`scheduled_at`) WHERE "check_in_records"."responded_at" IS NULL AND "check_in_records"."dismissed" = 0 AND "check_in_records"."archived" = 0;--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_records_idempotency_key_unique` ON `check_in_records` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `custom_fronts` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "custom_fronts_version_check" CHECK("custom_fronts"."version" >= 1),
	CONSTRAINT "custom_fronts_archived_consistency_check" CHECK(("custom_fronts"."archived" = true) = ("custom_fronts"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `custom_fronts_system_archived_idx` ON `custom_fronts` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_fronts_id_system_id_unique` ON `custom_fronts` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `device_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "device_tokens_platform_check" CHECK("device_tokens"."platform" IS NULL OR "device_tokens"."platform" IN ('ios', 'android', 'web'))
);
--> statement-breakpoint
CREATE INDEX `device_tokens_account_id_idx` ON `device_tokens` (`account_id`);--> statement-breakpoint
CREATE INDEX `device_tokens_system_id_idx` ON `device_tokens` (`system_id`);--> statement-breakpoint
CREATE INDEX `device_tokens_revoked_at_idx` ON `device_tokens` (`revoked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_token_platform_unique` ON `device_tokens` (`token`,`platform`);--> statement-breakpoint
CREATE TABLE `device_transfer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`source_session_id` text NOT NULL,
	`target_session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`encrypted_key_material` blob,
	`code_salt` blob NOT NULL,
	`code_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "device_transfer_requests_status_check" CHECK("device_transfer_requests"."status" IS NULL OR "device_transfer_requests"."status" IN ('pending', 'approved', 'expired')),
	CONSTRAINT "device_transfer_requests_expires_at_check" CHECK("device_transfer_requests"."expires_at" > "device_transfer_requests"."created_at"),
	CONSTRAINT "device_transfer_requests_key_material_check" CHECK("device_transfer_requests"."status" != 'approved' OR "device_transfer_requests"."encrypted_key_material" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `device_transfer_requests_account_status_idx` ON `device_transfer_requests` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `device_transfer_requests_status_expires_idx` ON `device_transfer_requests` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `export_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`blob_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blob_id`) REFERENCES `blob_metadata`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "export_requests_format_check" CHECK("export_requests"."format" IS NULL OR "export_requests"."format" IN ('json', 'csv')),
	CONSTRAINT "export_requests_status_check" CHECK("export_requests"."status" IS NULL OR "export_requests"."status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `export_requests_account_id_idx` ON `export_requests` (`account_id`);--> statement-breakpoint
CREATE INDEX `export_requests_system_id_idx` ON `export_requests` (`system_id`);--> statement-breakpoint
CREATE TABLE `field_bucket_visibility` (
	`field_definition_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`field_definition_id`, `bucket_id`),
	FOREIGN KEY (`field_definition_id`) REFERENCES `field_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `field_bucket_visibility_bucket_id_idx` ON `field_bucket_visibility` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `field_bucket_visibility_system_id_idx` ON `field_bucket_visibility` (`system_id`);--> statement-breakpoint
CREATE TABLE `field_definition_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`field_definition_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_entity_type_id` text,
	`system_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_definition_id`,`system_id`) REFERENCES `field_definitions`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scope_entity_type_id`,`system_id`) REFERENCES `system_structure_entity_types`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "field_definition_scopes_scope_type_check" CHECK("field_definition_scopes"."scope_type" IS NULL OR "field_definition_scopes"."scope_type" IN ('system', 'member', 'group', 'structure-entity-type')),
	CONSTRAINT "field_definition_scopes_entity_type_check" CHECK("field_definition_scopes"."scope_entity_type_id" IS NULL OR "field_definition_scopes"."scope_type" = 'structure-entity-type'),
	CONSTRAINT "field_definition_scopes_version_check" CHECK("field_definition_scopes"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `field_definition_scopes_field_definition_id_idx` ON `field_definition_scopes` (`field_definition_id`);--> statement-breakpoint
CREATE INDEX `field_definition_scopes_system_id_idx` ON `field_definition_scopes` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `field_definition_scopes_definition_scope_null_uniq` ON `field_definition_scopes` (`field_definition_id`,`scope_type`) WHERE "field_definition_scopes"."scope_entity_type_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `field_definition_scopes_definition_scope_uniq` ON `field_definition_scopes` (`field_definition_id`,`scope_type`,`scope_entity_type_id`);--> statement-breakpoint
CREATE TABLE `field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`field_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "field_definitions_field_type_check" CHECK("field_definitions"."field_type" IS NULL OR "field_definitions"."field_type" IN ('text', 'number', 'boolean', 'date', 'color', 'select', 'multi-select', 'url')),
	CONSTRAINT "field_definitions_version_check" CHECK("field_definitions"."version" >= 1),
	CONSTRAINT "field_definitions_archived_consistency_check" CHECK(("field_definitions"."archived" = true) = ("field_definitions"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `field_definitions_system_archived_idx` ON `field_definitions` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `field_definitions_id_system_id_unique` ON `field_definitions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`field_definition_id` text NOT NULL,
	`member_id` text,
	`structure_entity_id` text,
	`group_id` text,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_definition_id`,`system_id`) REFERENCES `field_definitions`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`structure_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`,`system_id`) REFERENCES `groups`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "field_values_version_check" CHECK("field_values"."version" >= 1),
	CONSTRAINT "field_values_subject_exclusivity_check" CHECK((CASE WHEN "field_values"."member_id" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN "field_values"."structure_entity_id" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN "field_values"."group_id" IS NOT NULL THEN 1 ELSE 0 END) <= 1)
);
--> statement-breakpoint
CREATE INDEX `field_values_definition_system_idx` ON `field_values` (`field_definition_id`,`system_id`);--> statement-breakpoint
CREATE INDEX `field_values_system_member_idx` ON `field_values` (`system_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `field_values_system_entity_idx` ON `field_values` (`system_id`,`structure_entity_id`);--> statement-breakpoint
CREATE INDEX `field_values_system_group_idx` ON `field_values` (`system_id`,`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_member_uniq` ON `field_values` (`field_definition_id`,`member_id`) WHERE "field_values"."member_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_entity_uniq` ON `field_values` (`field_definition_id`,`structure_entity_id`) WHERE "field_values"."structure_entity_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_group_uniq` ON `field_values` (`field_definition_id`,`group_id`) WHERE "field_values"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_system_uniq` ON `field_values` (`field_definition_id`,`system_id`) WHERE "field_values"."member_id" IS NULL AND "field_values"."structure_entity_id" IS NULL AND "field_values"."group_id" IS NULL;--> statement-breakpoint
CREATE TABLE `friend_bucket_assignments` (
	`friend_connection_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`friend_connection_id`, `bucket_id`),
	FOREIGN KEY (`friend_connection_id`) REFERENCES `friend_connections`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friend_bucket_assignments_bucket_id_idx` ON `friend_bucket_assignments` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `friend_bucket_assignments_system_id_idx` ON `friend_bucket_assignments` (`system_id`);--> statement-breakpoint
CREATE TABLE `friend_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "friend_codes_expires_at_check" CHECK("friend_codes"."expires_at" IS NULL OR "friend_codes"."expires_at" > "friend_codes"."created_at"),
	CONSTRAINT "friend_codes_code_min_length_check" CHECK(length("friend_codes"."code") >= 8),
	CONSTRAINT "friend_codes_archived_consistency_check" CHECK(("friend_codes"."archived" = true) = ("friend_codes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `friend_codes_account_archived_idx` ON `friend_codes` (`account_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `friend_codes_code_uniq` ON `friend_codes` (`code`) WHERE "friend_codes"."archived" = 0;--> statement-breakpoint
CREATE TABLE `friend_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`friend_account_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`encrypted_data` blob,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "friend_connections_status_check" CHECK("friend_connections"."status" IS NULL OR "friend_connections"."status" IN ('pending', 'accepted', 'blocked', 'removed')),
	CONSTRAINT "friend_connections_no_self_check" CHECK("friend_connections"."account_id" != "friend_connections"."friend_account_id"),
	CONSTRAINT "friend_connections_version_check" CHECK("friend_connections"."version" >= 1),
	CONSTRAINT "friend_connections_archived_consistency_check" CHECK(("friend_connections"."archived" = true) = ("friend_connections"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `friend_connections_account_status_idx` ON `friend_connections` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `friend_connections_friend_status_idx` ON `friend_connections` (`friend_account_id`,`status`);--> statement-breakpoint
CREATE INDEX `friend_connections_account_archived_idx` ON `friend_connections` (`account_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `friend_connections_account_friend_uniq` ON `friend_connections` (`account_id`,`friend_account_id`) WHERE "friend_connections"."archived" = 0;--> statement-breakpoint
CREATE UNIQUE INDEX `friend_connections_id_account_id_unique` ON `friend_connections` (`id`,`account_id`);--> statement-breakpoint
CREATE TABLE `friend_notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`friend_connection_id` text NOT NULL,
	`enabled_event_types` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_connection_id`,`account_id`) REFERENCES `friend_connections`(`id`,`account_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "friend_notification_preferences_archived_consistency_check" CHECK(("friend_notification_preferences"."archived" = true) = ("friend_notification_preferences"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_notification_prefs_account_id_friend_connection_id_idx` ON `friend_notification_preferences` (`account_id`,`friend_connection_id`) WHERE "friend_notification_preferences"."archived" = 0;--> statement-breakpoint
CREATE TABLE `fronting_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`fronting_session_id` text NOT NULL,
	`system_id` text NOT NULL,
	`member_id` text,
	`custom_front_id` text,
	`structure_entity_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fronting_session_id`,`system_id`) REFERENCES `fronting_sessions`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`structure_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fronting_comments_version_check" CHECK("fronting_comments"."version" >= 1),
	CONSTRAINT "fronting_comments_archived_consistency_check" CHECK(("fronting_comments"."archived" = true) = ("fronting_comments"."archived_at" IS NOT NULL)),
	CONSTRAINT "fronting_comments_author_check" CHECK(("fronting_comments"."member_id" IS NOT NULL OR "fronting_comments"."custom_front_id" IS NOT NULL OR "fronting_comments"."structure_entity_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `fronting_comments_session_created_idx` ON `fronting_comments` (`fronting_session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `fronting_comments_system_archived_idx` ON `fronting_comments` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `fronting_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`format` text NOT NULL,
	`generated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fronting_reports_format_check" CHECK("fronting_reports"."format" IS NULL OR "fronting_reports"."format" IN ('html', 'pdf')),
	CONSTRAINT "fronting_reports_version_check" CHECK("fronting_reports"."version" >= 1),
	CONSTRAINT "fronting_reports_archived_consistency_check" CHECK(("fronting_reports"."archived" = true) = ("fronting_reports"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `fronting_reports_system_id_idx` ON `fronting_reports` (`system_id`);--> statement-breakpoint
CREATE TABLE `fronting_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`member_id` text,
	`custom_front_id` text,
	`structure_entity_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`structure_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fronting_sessions_end_time_check" CHECK("fronting_sessions"."end_time" IS NULL OR "fronting_sessions"."end_time" > "fronting_sessions"."start_time"),
	CONSTRAINT "fronting_sessions_version_check" CHECK("fronting_sessions"."version" >= 1),
	CONSTRAINT "fronting_sessions_archived_consistency_check" CHECK(("fronting_sessions"."archived" = true) = ("fronting_sessions"."archived_at" IS NOT NULL)),
	CONSTRAINT "fronting_sessions_subject_check" CHECK(("fronting_sessions"."member_id" IS NOT NULL OR "fronting_sessions"."custom_front_id" IS NOT NULL OR "fronting_sessions"."structure_entity_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_start_idx` ON `fronting_sessions` (`system_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_member_start_idx` ON `fronting_sessions` (`system_id`,`member_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_end_idx` ON `fronting_sessions` (`system_id`,`end_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_active_idx` ON `fronting_sessions` (`system_id`) WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_archived_idx` ON `fronting_sessions` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_entity_start_idx` ON `fronting_sessions` (`system_id`,`structure_entity_id`,`start_time`);--> statement-breakpoint
CREATE UNIQUE INDEX `fronting_sessions_id_system_id_unique` ON `fronting_sessions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `group_memberships` (
	`group_id` text NOT NULL,
	`member_id` text NOT NULL,
	`system_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `member_id`),
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`,`system_id`) REFERENCES `groups`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `group_memberships_member_id_idx` ON `group_memberships` (`member_id`);--> statement-breakpoint
CREATE INDEX `group_memberships_system_id_idx` ON `group_memberships` (`system_id`);--> statement-breakpoint
CREATE INDEX `group_memberships_system_group_idx` ON `group_memberships` (`system_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_group_id` text,
	`sort_order` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_group_id`,`system_id`) REFERENCES `groups`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "groups_sort_order_check" CHECK("groups"."sort_order" >= 0),
	CONSTRAINT "groups_version_check" CHECK("groups"."version" >= 1),
	CONSTRAINT "groups_archived_consistency_check" CHECK(("groups"."archived" = true) = ("groups"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `groups_system_archived_idx` ON `groups` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_id_system_id_unique` ON `groups` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`error_log` text,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`chunks_total` integer,
	`chunks_completed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "import_jobs_source_check" CHECK("import_jobs"."source" IS NULL OR "import_jobs"."source" IN ('simply-plural', 'pluralkit', 'pluralscape')),
	CONSTRAINT "import_jobs_status_check" CHECK("import_jobs"."status" IS NULL OR "import_jobs"."status" IN ('pending', 'validating', 'importing', 'completed', 'failed')),
	CONSTRAINT "import_jobs_progress_percent_check" CHECK("import_jobs"."progress_percent" >= 0 AND "import_jobs"."progress_percent" <= 100),
	CONSTRAINT "import_jobs_chunks_check" CHECK("import_jobs"."chunks_total" IS NULL OR "import_jobs"."chunks_completed" <= "import_jobs"."chunks_total"),
	CONSTRAINT "import_jobs_error_log_length_check" CHECK("import_jobs"."error_log" IS NULL OR json_array_length("import_jobs"."error_log") <= 1000)
);
--> statement-breakpoint
CREATE INDEX `import_jobs_account_id_status_idx` ON `import_jobs` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `import_jobs_system_id_idx` ON `import_jobs` (`system_id`);--> statement-breakpoint
CREATE TABLE `innerworld_canvas` (
	`system_id` text PRIMARY KEY NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "innerworld_canvas_version_check" CHECK("innerworld_canvas"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `innerworld_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`region_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`region_id`) REFERENCES `innerworld_regions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "innerworld_entities_version_check" CHECK("innerworld_entities"."version" >= 1),
	CONSTRAINT "innerworld_entities_archived_consistency_check" CHECK(("innerworld_entities"."archived" = true) = ("innerworld_entities"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `innerworld_entities_region_id_idx` ON `innerworld_entities` (`region_id`);--> statement-breakpoint
CREATE INDEX `innerworld_entities_system_archived_idx` ON `innerworld_entities` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `innerworld_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_region_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_region_id`,`system_id`) REFERENCES `innerworld_regions`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "innerworld_regions_version_check" CHECK("innerworld_regions"."version" >= 1),
	CONSTRAINT "innerworld_regions_archived_consistency_check" CHECK(("innerworld_regions"."archived" = true) = ("innerworld_regions"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `innerworld_regions_system_archived_idx` ON `innerworld_regions` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `innerworld_regions_id_system_id_unique` ON `innerworld_regions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`next_retry_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`idempotency_key` text,
	`last_heartbeat_at` integer,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`result` text,
	`scheduled_for` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jobs_status_check" CHECK("jobs"."status" IS NULL OR "jobs"."status" IN ('pending', 'running', 'completed', 'cancelled', 'dead-letter')),
	CONSTRAINT "jobs_type_check" CHECK("jobs"."type" IS NULL OR "jobs"."type" IN ('sync-push', 'sync-pull', 'blob-upload', 'blob-cleanup', 'export-generate', 'import-process', 'webhook-deliver', 'notification-send', 'analytics-compute', 'account-purge', 'bucket-key-rotation', 'report-generate', 'audit-log-cleanup', 'partition-maintenance', 'device-transfer-cleanup', 'sync-queue-cleanup', 'sync-compaction', 'check-in-generate')),
	CONSTRAINT "jobs_attempts_max_check" CHECK("jobs"."attempts" <= "jobs"."max_attempts"),
	CONSTRAINT "jobs_timeout_ms_check" CHECK("jobs"."timeout_ms" > 0)
);
--> statement-breakpoint
CREATE INDEX `jobs_status_next_retry_at_idx` ON `jobs` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_idx` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_priority_status_scheduled_idx` ON `jobs` (`priority`,`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `jobs_heartbeat_idx` ON `jobs` (`status`,`last_heartbeat_at`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`fronting_session_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fronting_session_id`) REFERENCES `fronting_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "journal_entries_version_check" CHECK("journal_entries"."version" >= 1),
	CONSTRAINT "journal_entries_archived_consistency_check" CHECK(("journal_entries"."archived" = true) = ("journal_entries"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `journal_entries_system_id_created_at_idx` ON `journal_entries` (`system_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `journal_entries_system_archived_idx` ON `journal_entries` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `journal_entries_fronting_session_id_idx` ON `journal_entries` (`fronting_session_id`);--> statement-breakpoint
CREATE TABLE `key_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	`friend_account_id` text NOT NULL,
	`encrypted_key` blob NOT NULL,
	`key_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "key_grants_key_version_check" CHECK("key_grants"."key_version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `key_grants_system_id_idx` ON `key_grants` (`system_id`);--> statement-breakpoint
CREATE INDEX `key_grants_friend_bucket_idx` ON `key_grants` (`friend_account_id`,`bucket_id`);--> statement-breakpoint
CREATE INDEX `key_grants_friend_revoked_idx` ON `key_grants` (`friend_account_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `key_grants_revoked_at_idx` ON `key_grants` (`revoked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `key_grants_bucket_friend_version_uniq` ON `key_grants` (`bucket_id`,`friend_account_id`,`key_version`);--> statement-breakpoint
CREATE TABLE `lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`plaintext_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lifecycle_events_event_type_check" CHECK("lifecycle_events"."event_type" IS NULL OR "lifecycle_events"."event_type" IN ('split', 'fusion', 'merge', 'unmerge', 'dormancy-start', 'dormancy-end', 'discovery', 'archival', 'structure-entity-formation', 'form-change', 'name-change', 'structure-move', 'innerworld-move')),
	CONSTRAINT "lifecycle_events_version_check" CHECK("lifecycle_events"."version" >= 1),
	CONSTRAINT "lifecycle_events_archived_consistency_check" CHECK(("lifecycle_events"."archived" = true) = ("lifecycle_events"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_occurred_idx` ON `lifecycle_events` (`system_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_recorded_idx` ON `lifecycle_events` (`system_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_archived_idx` ON `lifecycle_events` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `member_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`system_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "member_photos_version_check" CHECK("member_photos"."version" >= 1),
	CONSTRAINT "member_photos_archived_consistency_check" CHECK(("member_photos"."archived" = true) = ("member_photos"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `member_photos_system_archived_idx` ON `member_photos` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `member_photos_member_sort_idx` ON `member_photos` (`member_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "members_version_check" CHECK("members"."version" >= 1),
	CONSTRAINT "members_archived_consistency_check" CHECK(("members"."archived" = true) = ("members"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `members_system_id_archived_idx` ON `members` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `members_created_at_idx` ON `members` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_id_system_id_unique` ON `members` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`id`, `timestamp`),
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`,`system_id`) REFERENCES `channels`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "messages_version_check" CHECK("messages"."version" >= 1),
	CONSTRAINT "messages_archived_consistency_check" CHECK(("messages"."archived" = true) = ("messages"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `messages_channel_id_timestamp_idx` ON `messages` (`channel_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `messages_system_archived_idx` ON `messages` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `messages_reply_to_id_idx` ON `messages` (`reply_to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_unique` ON `messages` (`id`,`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_system_id_timestamp_unique` ON `messages` (`id`,`system_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `nomenclature_settings` (
	`system_id` text PRIMARY KEY NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "nomenclature_settings_version_check" CHECK("nomenclature_settings"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`author_entity_type` text,
	`author_entity_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notes_author_null_pair_check" CHECK(("notes"."author_entity_type" IS NULL) = ("notes"."author_entity_id" IS NULL)),
	CONSTRAINT "notes_author_entity_type_check" CHECK("notes"."author_entity_type" IS NULL OR "notes"."author_entity_type" IN ('member', 'structure-entity')),
	CONSTRAINT "notes_version_check" CHECK("notes"."version" >= 1),
	CONSTRAINT "notes_archived_consistency_check" CHECK(("notes"."archived" = true) = ("notes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `notes_system_archived_idx` ON `notes` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `notes_system_archived_created_idx` ON `notes` (`system_id`,`archived`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `notes_system_author_type_archived_idx` ON `notes` (`system_id`,`author_entity_type`,`archived`);--> statement-breakpoint
CREATE INDEX `notes_author_entity_id_idx` ON `notes` (`author_entity_id`);--> statement-breakpoint
CREATE TABLE `notification_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_configs_event_type_check" CHECK("notification_configs"."event_type" IS NULL OR "notification_configs"."event_type" IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
	CONSTRAINT "notification_configs_archived_consistency_check" CHECK(("notification_configs"."archived" = true) = ("notification_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_configs_system_id_event_type_idx` ON `notification_configs` (`system_id`,`event_type`) WHERE "notification_configs"."archived" = 0;--> statement-breakpoint
CREATE TABLE `pk_bridge_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sync_direction` text NOT NULL,
	`pk_token_encrypted` blob NOT NULL,
	`entity_mappings` blob NOT NULL,
	`error_log` blob NOT NULL,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pk_bridge_configs_sync_direction_check" CHECK("pk_bridge_configs"."sync_direction" IS NULL OR "pk_bridge_configs"."sync_direction" IN ('ps-to-pk', 'pk-to-ps', 'bidirectional')),
	CONSTRAINT "pk_bridge_configs_version_check" CHECK("pk_bridge_configs"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pk_bridge_configs_system_id_idx` ON `pk_bridge_configs` (`system_id`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`system_id` text NOT NULL,
	`option_id` text,
	`voter` text,
	`is_veto` integer DEFAULT false NOT NULL,
	`voted_at` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`,`system_id`) REFERENCES `polls`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "poll_votes_voter_not_null" CHECK("poll_votes"."voter" IS NOT NULL),
	CONSTRAINT "poll_votes_archived_consistency_check" CHECK(("poll_votes"."archived" = true) = ("poll_votes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `poll_votes_poll_id_idx` ON `poll_votes` (`poll_id`);--> statement-breakpoint
CREATE INDEX `poll_votes_poll_created_idx` ON `poll_votes` (`poll_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `poll_votes_system_archived_idx` ON `poll_votes` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `polls` (
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
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "polls_status_check" CHECK("polls"."status" IS NULL OR "polls"."status" IN ('open', 'closed')),
	CONSTRAINT "polls_kind_check" CHECK("polls"."kind" IS NULL OR "polls"."kind" IN ('standard', 'custom')),
	CONSTRAINT "polls_max_votes_check" CHECK("polls"."max_votes_per_member" >= 1),
	CONSTRAINT "polls_version_check" CHECK("polls"."version" >= 1),
	CONSTRAINT "polls_archived_consistency_check" CHECK(("polls"."archived" = true) = ("polls"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `polls_system_archived_idx` ON `polls` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `polls_system_archived_created_idx` ON `polls` (`system_id`,`archived`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `polls_id_system_id_unique` ON `polls` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `recovery_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`encrypted_master_key` blob NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recovery_keys_account_id_idx` ON `recovery_keys` (`account_id`);--> statement-breakpoint
CREATE INDEX `recovery_keys_revoked_at_idx` ON `recovery_keys` (`revoked_at`) WHERE "recovery_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE TABLE `relationships` (
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
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "relationships_type_check" CHECK("relationships"."type" IS NULL OR "relationships"."type" IN ('split-from', 'fused-from', 'sibling', 'partner', 'parent-child', 'protector-of', 'caretaker-of', 'gatekeeper-of', 'source', 'custom')),
	CONSTRAINT "relationships_version_check" CHECK("relationships"."version" >= 1),
	CONSTRAINT "relationships_archived_consistency_check" CHECK(("relationships"."archived" = true) = ("relationships"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `relationships_system_archived_idx` ON `relationships` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `safe_mode_content` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "safe_mode_content_version_check" CHECK("safe_mode_content"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `safe_mode_content_system_sort_idx` ON `safe_mode_content` (`system_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`encrypted_data` blob,
	`created_at` integer NOT NULL,
	`last_active` integer,
	`revoked` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessions_expires_at_check" CHECK("sessions"."expires_at" IS NULL OR "sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE INDEX `sessions_account_id_idx` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_revoked_last_active_idx` ON `sessions` (`revoked`,`last_active`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`) WHERE "sessions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `sync_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`seq` integer NOT NULL,
	`encrypted_payload` blob NOT NULL,
	`author_public_key` blob NOT NULL,
	`nonce` blob NOT NULL,
	`signature` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `sync_documents`(`document_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_changes_document_id_seq_idx` ON `sync_changes` (`document_id`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `sync_changes_dedup_idx` ON `sync_changes` (`document_id`,`author_public_key`,`nonce`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field_name` text,
	`resolution` text NOT NULL,
	`detected_at` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `sync_documents`(`document_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_conflicts_document_id_idx` ON `sync_conflicts` (`document_id`);--> statement-breakpoint
CREATE INDEX `sync_conflicts_detected_at_idx` ON `sync_conflicts` (`detected_at`);--> statement-breakpoint
CREATE TABLE `sync_documents` (
	`document_id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`snapshot_version` integer DEFAULT 0 NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`time_period` text,
	`key_type` text DEFAULT 'derived' NOT NULL,
	`bucket_id` text,
	`channel_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_documents_doc_type_check" CHECK("sync_documents"."doc_type" IS NULL OR "sync_documents"."doc_type" IN ('system-core', 'fronting', 'chat', 'note', 'journal', 'privacy-config', 'bucket')),
	CONSTRAINT "sync_documents_key_type_check" CHECK("sync_documents"."key_type" IS NULL OR "sync_documents"."key_type" IN ('derived', 'bucket')),
	CONSTRAINT "sync_documents_size_bytes_check" CHECK("sync_documents"."size_bytes" >= 0),
	CONSTRAINT "sync_documents_snapshot_version_check" CHECK("sync_documents"."snapshot_version" >= 0),
	CONSTRAINT "sync_documents_last_seq_check" CHECK("sync_documents"."last_seq" >= 0)
);
--> statement-breakpoint
CREATE INDEX `sync_documents_system_id_idx` ON `sync_documents` (`system_id`);--> statement-breakpoint
CREATE INDEX `sync_documents_system_id_doc_type_idx` ON `sync_documents` (`system_id`,`doc_type`);--> statement-breakpoint
CREATE TABLE `sync_snapshots` (
	`document_id` text PRIMARY KEY NOT NULL,
	`snapshot_version` integer NOT NULL,
	`encrypted_payload` blob NOT NULL,
	`author_public_key` blob NOT NULL,
	`nonce` blob NOT NULL,
	`signature` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `sync_documents`(`document_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_snapshots_snapshot_version_check" CHECK("sync_snapshots"."snapshot_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`locale` text,
	`pin_hash` text,
	`biometric_enabled` integer DEFAULT false NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "system_settings_version_check" CHECK("system_settings"."version" >= 1),
	CONSTRAINT "system_settings_pin_hash_kdf_check" CHECK("system_settings"."pin_hash" IS NULL OR "system_settings"."pin_hash" LIKE '$argon2id$%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_system_id_unique` ON `system_settings` (`system_id`);--> statement-breakpoint
CREATE TABLE `system_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`snapshot_trigger` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "system_snapshots_snapshot_trigger_check" CHECK("system_snapshots"."snapshot_trigger" IS NULL OR "system_snapshots"."snapshot_trigger" IN ('manual', 'scheduled-daily', 'scheduled-weekly'))
);
--> statement-breakpoint
CREATE INDEX `system_snapshots_system_created_idx` ON `system_snapshots` (`system_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `system_structure_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`entity_type_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_type_id`,`system_id`) REFERENCES `system_structure_entity_types`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "system_structure_entities_version_check" CHECK("system_structure_entities"."version" >= 1),
	CONSTRAINT "system_structure_entities_archived_consistency_check" CHECK(("system_structure_entities"."archived" = true) = ("system_structure_entities"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `system_structure_entities_system_archived_idx` ON `system_structure_entities` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `system_structure_entities_entity_type_id_idx` ON `system_structure_entities` (`system_id`,`entity_type_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entities_id_system_id_unique` ON `system_structure_entities` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `system_structure_entity_associations` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`source_entity_id` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "system_structure_entity_associations_no_self_link" CHECK("system_structure_entity_associations"."source_entity_id" <> "system_structure_entity_associations"."target_entity_id")
);
--> statement-breakpoint
CREATE INDEX `system_structure_entity_associations_system_source_idx` ON `system_structure_entity_associations` (`system_id`,`source_entity_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_associations_system_target_idx` ON `system_structure_entity_associations` (`system_id`,`target_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_associations_uniq` ON `system_structure_entity_associations` (`source_entity_id`,`target_entity_id`);--> statement-breakpoint
CREATE TABLE `system_structure_entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`parent_entity_id` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `system_structure_entity_links_system_entity_idx` ON `system_structure_entity_links` (`system_id`,`entity_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_links_system_parent_idx` ON `system_structure_entity_links` (`system_id`,`parent_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_links_entity_root_uniq` ON `system_structure_entity_links` (`entity_id`) WHERE "system_structure_entity_links"."parent_entity_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_links_entity_parent_uniq` ON `system_structure_entity_links` (`entity_id`,`parent_entity_id`);--> statement-breakpoint
CREATE TABLE `system_structure_entity_member_links` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_entity_id` text,
	`member_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `system_structure_entity_member_links_system_member_idx` ON `system_structure_entity_member_links` (`system_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_member_links_system_parent_idx` ON `system_structure_entity_member_links` (`system_id`,`parent_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_member_links_member_root_uniq` ON `system_structure_entity_member_links` (`member_id`) WHERE "system_structure_entity_member_links"."parent_entity_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_member_links_member_parent_uniq` ON `system_structure_entity_member_links` (`member_id`,`parent_entity_id`);--> statement-breakpoint
CREATE TABLE `system_structure_entity_types` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "system_structure_entity_types_version_check" CHECK("system_structure_entity_types"."version" >= 1),
	CONSTRAINT "system_structure_entity_types_archived_consistency_check" CHECK(("system_structure_entity_types"."archived" = true) = ("system_structure_entity_types"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `system_structure_entity_types_system_archived_idx` ON `system_structure_entity_types` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_types_id_system_id_unique` ON `system_structure_entity_types` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `systems` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`encrypted_data` blob,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "systems_version_check" CHECK("systems"."version" >= 1),
	CONSTRAINT "systems_archived_consistency_check" CHECK(("systems"."archived" = true) = ("systems"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `systems_account_id_idx` ON `systems` (`account_id`);--> statement-breakpoint
CREATE TABLE `timer_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`interval_minutes` integer,
	`waking_hours_only` integer,
	`waking_start` text,
	`waking_end` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "timer_configs_version_check" CHECK("timer_configs"."version" >= 1),
	CONSTRAINT "timer_configs_waking_start_format" CHECK("timer_configs"."waking_start" IS NULL OR (
    length("timer_configs"."waking_start") = 5
    AND substr("timer_configs"."waking_start", 3, 1) = ':'
    AND substr("timer_configs"."waking_start", 1, 1) BETWEEN '0' AND '2'
    AND substr("timer_configs"."waking_start", 2, 1) BETWEEN '0' AND '9'
    AND (substr("timer_configs"."waking_start", 1, 1) < '2' OR substr("timer_configs"."waking_start", 2, 1) <= '3')
    AND substr("timer_configs"."waking_start", 4, 1) BETWEEN '0' AND '5'
    AND substr("timer_configs"."waking_start", 5, 1) BETWEEN '0' AND '9'
  )),
	CONSTRAINT "timer_configs_waking_end_format" CHECK("timer_configs"."waking_end" IS NULL OR (
    length("timer_configs"."waking_end") = 5
    AND substr("timer_configs"."waking_end", 3, 1) = ':'
    AND substr("timer_configs"."waking_end", 1, 1) BETWEEN '0' AND '2'
    AND substr("timer_configs"."waking_end", 2, 1) BETWEEN '0' AND '9'
    AND (substr("timer_configs"."waking_end", 1, 1) < '2' OR substr("timer_configs"."waking_end", 2, 1) <= '3')
    AND substr("timer_configs"."waking_end", 4, 1) BETWEEN '0' AND '5'
    AND substr("timer_configs"."waking_end", 5, 1) BETWEEN '0' AND '9'
  )),
	CONSTRAINT "timer_configs_archived_consistency_check" CHECK(("timer_configs"."archived" = true) = ("timer_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `timer_configs_system_archived_idx` ON `timer_configs` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `timer_configs_id_system_id_unique` ON `timer_configs` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `webhook_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` blob NOT NULL,
	`event_types` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`crypto_key_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`crypto_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "webhook_configs_version_check" CHECK("webhook_configs"."version" >= 1),
	CONSTRAINT "webhook_configs_archived_consistency_check" CHECK(("webhook_configs"."archived" = true) = ("webhook_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `webhook_configs_system_archived_idx` ON `webhook_configs` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_configs_id_system_id_unique` ON `webhook_configs` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`http_status` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`next_retry_at` integer,
	`encrypted_data` blob,
	`payload_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`,`system_id`) REFERENCES `webhook_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "webhook_deliveries_event_type_check" CHECK("webhook_deliveries"."event_type" IS NULL OR "webhook_deliveries"."event_type" IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'group.created', 'group.updated', 'lifecycle.event-recorded', 'custom-front.changed', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'poll-vote.updated', 'poll-vote.archived', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend.connected', 'friend.removed', 'friend.bucket-assigned', 'friend.bucket-unassigned')),
	CONSTRAINT "webhook_deliveries_status_check" CHECK("webhook_deliveries"."status" IS NULL OR "webhook_deliveries"."status" IN ('pending', 'success', 'failed')),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK("webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_http_status_check" CHECK("webhook_deliveries"."http_status" IS NULL OR ("webhook_deliveries"."http_status" >= 100 AND "webhook_deliveries"."http_status" <= 599)),
	CONSTRAINT "webhook_deliveries_payload_presence_check" CHECK("webhook_deliveries"."encrypted_data" IS NOT NULL OR "webhook_deliveries"."payload_data" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_id_idx` ON `webhook_deliveries` (`system_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_next_retry_at_idx` ON `webhook_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_terminal_created_at_idx` ON `webhook_deliveries` (`created_at`) WHERE "webhook_deliveries"."status" IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_retry_idx` ON `webhook_deliveries` (`system_id`,`status`,`next_retry_at`) WHERE "webhook_deliveries"."status" NOT IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX `webhook_deliveries_pending_retry_idx` ON `webhook_deliveries` (`next_retry_at`) WHERE "webhook_deliveries"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `wiki_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`slug_hash` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "wiki_pages_version_check" CHECK("wiki_pages"."version" >= 1),
	CONSTRAINT "wiki_pages_archived_consistency_check" CHECK(("wiki_pages"."archived" = true) = ("wiki_pages"."archived_at" IS NOT NULL)),
	CONSTRAINT "wiki_pages_slug_hash_length_check" CHECK(length("wiki_pages"."slug_hash") = 64)
);
--> statement-breakpoint
CREATE INDEX `wiki_pages_system_archived_idx` ON `wiki_pages` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_pages_system_id_slug_hash_idx` ON `wiki_pages` (`system_id`,`slug_hash`) WHERE "wiki_pages"."archived" = 0;