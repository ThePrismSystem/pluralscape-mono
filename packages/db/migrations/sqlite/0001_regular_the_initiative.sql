PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_log` (
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
	CONSTRAINT "audit_log_event_type_check" CHECK("__new_audit_log"."event_type" IS NULL OR "__new_audit_log"."event_type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "audit_log_detail_length_check" CHECK("__new_audit_log"."detail" IS NULL OR length("__new_audit_log"."detail") <= 2048)
);
--> statement-breakpoint
INSERT INTO `__new_audit_log`("id", "account_id", "system_id", "event_type", "timestamp", "ip_address", "user_agent", "actor", "detail") SELECT "id", "account_id", "system_id", "event_type", "timestamp", "ip_address", "user_agent", "actor", "detail" FROM `audit_log`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
ALTER TABLE `__new_audit_log` RENAME TO `audit_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_log_account_timestamp_idx` ON `audit_log` (`account_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_timestamp_idx` ON `audit_log` (`system_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_event_type_timestamp_idx` ON `audit_log` (`system_id`,`event_type`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_id_unique` ON `audit_log` (`id`,`timestamp`);--> statement-breakpoint
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
	`checksum` text,
	`created_at` integer NOT NULL,
	`uploaded_at` integer,
	`expires_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumbnail_of_blob_id`) REFERENCES `blob_metadata`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "blob_metadata_purpose_check" CHECK("__new_blob_metadata"."purpose" IS NULL OR "__new_blob_metadata"."purpose" IN (?, ?, ?, ?, ?, ?)),
	CONSTRAINT "blob_metadata_size_bytes_check" CHECK("__new_blob_metadata"."size_bytes" > 0),
	CONSTRAINT "blob_metadata_size_bytes_max_check" CHECK("__new_blob_metadata"."size_bytes" <= 10737418240),
	CONSTRAINT "blob_metadata_encryption_tier_check" CHECK("__new_blob_metadata"."encryption_tier" IN (1, 2)),
	CONSTRAINT "blob_metadata_checksum_length_check" CHECK("__new_blob_metadata"."checksum" IS NULL OR length("__new_blob_metadata"."checksum") = 64),
	CONSTRAINT "blob_metadata_pending_consistency_check" CHECK(("__new_blob_metadata"."checksum" IS NULL) = ("__new_blob_metadata"."uploaded_at" IS NULL)),
	CONSTRAINT "blob_metadata_archived_consistency_check" CHECK(("__new_blob_metadata"."archived" = true) = ("__new_blob_metadata"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_blob_metadata`("id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "created_at", "uploaded_at", "expires_at", "archived", "archived_at") SELECT "id", "system_id", "storage_key", "mime_type", "size_bytes", "encryption_tier", "bucket_id", "purpose", "thumbnail_of_blob_id", "checksum", "created_at", "uploaded_at", "expires_at", "archived", "archived_at" FROM `blob_metadata`;--> statement-breakpoint
DROP TABLE `blob_metadata`;--> statement-breakpoint
ALTER TABLE `__new_blob_metadata` RENAME TO `blob_metadata`;--> statement-breakpoint
CREATE INDEX `blob_metadata_system_id_purpose_idx` ON `blob_metadata` (`system_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `blob_metadata_system_archived_idx` ON `blob_metadata` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_storage_key_idx` ON `blob_metadata` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `blob_metadata_id_system_id_unique` ON `blob_metadata` (`id`,`system_id`);