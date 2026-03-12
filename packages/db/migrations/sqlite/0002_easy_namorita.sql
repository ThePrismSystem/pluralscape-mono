PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	CONSTRAINT "jobs_status_check" CHECK("__new_jobs"."status" IS NULL OR "__new_jobs"."status" IN (?, ?, ?, ?, ?, ?)),
	CONSTRAINT "jobs_type_check" CHECK("__new_jobs"."type" IS NULL OR "__new_jobs"."type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "jobs_attempts_max_check" CHECK("__new_jobs"."attempts" <= "__new_jobs"."max_attempts"),
	CONSTRAINT "jobs_timeout_ms_check" CHECK("__new_jobs"."timeout_ms" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "system_id", "type", "payload", "status", "attempts", "max_attempts", "next_retry_at", "error", "created_at", "started_at", "completed_at", "idempotency_key", "last_heartbeat_at", "timeout_ms", "result", "scheduled_for", "priority") SELECT "id", "system_id", "type", "payload", "status", "attempts", "max_attempts", "next_retry_at", "error", "created_at", "started_at", "completed_at", "idempotency_key", "last_heartbeat_at", "timeout_ms", "result", "scheduled_for", "priority" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `jobs_status_next_retry_at_idx` ON `jobs` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_idx` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_priority_status_scheduled_idx` ON `jobs` (`priority`,`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `jobs_heartbeat_idx` ON `jobs` (`status`,`last_heartbeat_at`);--> statement-breakpoint
CREATE INDEX `sync_queue_system_id_entity_type_entity_id_idx` ON `sync_queue` (`system_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `sync_queue_unsynced_idx` ON `sync_queue` (`system_id`) WHERE "sync_queue"."synced_at" IS NULL;--> statement-breakpoint
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
	CONSTRAINT "blob_metadata_encryption_tier_check" CHECK("__new_blob_metadata"."encryption_tier" IN (1, 2))
);
--> statement-breakpoint
INSERT INTO `__new_blob_metadata`("id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "uploaded_at") SELECT "id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "uploaded_at" FROM `blob_metadata`;--> statement-breakpoint
DROP TABLE `blob_metadata`;--> statement-breakpoint
ALTER TABLE `__new_blob_metadata` RENAME TO `blob_metadata`;--> statement-breakpoint
CREATE INDEX `blob_metadata_system_id_idx` ON `blob_metadata` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_storage_key_idx` ON `blob_metadata` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_id_system_id_unique` ON `blob_metadata` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_device_tokens` (
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
	CONSTRAINT "device_tokens_platform_check" CHECK("__new_device_tokens"."platform" IS NULL OR "__new_device_tokens"."platform" IN (?, ?, ?))
);
--> statement-breakpoint
INSERT INTO `__new_device_tokens`("id", "account_id", "system_id", "platform", "token", "created_at", "last_active_at", "revoked_at") SELECT "id", "account_id", "system_id", "platform", "token", "created_at", "last_active_at", "revoked_at" FROM `device_tokens`;--> statement-breakpoint
DROP TABLE `device_tokens`;--> statement-breakpoint
ALTER TABLE `__new_device_tokens` RENAME TO `device_tokens`;--> statement-breakpoint
CREATE INDEX `device_tokens_account_id_idx` ON `device_tokens` (`account_id`);--> statement-breakpoint
CREATE INDEX `device_tokens_system_id_idx` ON `device_tokens` (`system_id`);--> statement-breakpoint
CREATE INDEX `device_tokens_revoked_at_idx` ON `device_tokens` (`revoked_at`);--> statement-breakpoint
CREATE TABLE `__new_notification_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_configs_event_type_check" CHECK("__new_notification_configs"."event_type" IS NULL OR "__new_notification_configs"."event_type" IN (?, ?, ?, ?, ?, ?))
);
--> statement-breakpoint
INSERT INTO `__new_notification_configs`("id", "system_id", "event_type", "enabled", "push_enabled", "created_at", "updated_at") SELECT "id", "system_id", "event_type", "enabled", "push_enabled", "created_at", "updated_at" FROM `notification_configs`;--> statement-breakpoint
DROP TABLE `notification_configs`;--> statement-breakpoint
ALTER TABLE `__new_notification_configs` RENAME TO `notification_configs`;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_configs_system_id_event_type_idx` ON `notification_configs` (`system_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `__new_webhook_deliveries` (
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
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`,`system_id`) REFERENCES `webhook_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "webhook_deliveries_event_type_check" CHECK("__new_webhook_deliveries"."event_type" IS NULL OR "__new_webhook_deliveries"."event_type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "webhook_deliveries_status_check" CHECK("__new_webhook_deliveries"."status" IS NULL OR "__new_webhook_deliveries"."status" IN (?, ?, ?)),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK("__new_webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_http_status_check" CHECK("__new_webhook_deliveries"."http_status" IS NULL OR ("__new_webhook_deliveries"."http_status" >= 100 AND "__new_webhook_deliveries"."http_status" <= 599))
);
--> statement-breakpoint
INSERT INTO `__new_webhook_deliveries`("id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "created_at") SELECT "id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "created_at" FROM `webhook_deliveries`;--> statement-breakpoint
DROP TABLE `webhook_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_webhook_deliveries` RENAME TO `webhook_deliveries`;--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_id_idx` ON `webhook_deliveries` (`system_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_next_retry_at_idx` ON `webhook_deliveries` (`status`,`next_retry_at`);