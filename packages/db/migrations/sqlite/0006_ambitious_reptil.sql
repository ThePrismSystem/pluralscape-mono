DROP INDEX `recovery_keys_revoked_at_idx`;--> statement-breakpoint
CREATE INDEX `recovery_keys_revoked_at_idx` ON `recovery_keys` (`revoked_at`) WHERE "recovery_keys"."revoked_at" IS NULL;--> statement-breakpoint
DROP INDEX `sessions_expires_at_idx`;--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`) WHERE "sessions"."expires_at" IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_import_jobs` (
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
	CONSTRAINT "import_jobs_source_check" CHECK("__new_import_jobs"."source" IS NULL OR "__new_import_jobs"."source" IN (?, ?, ?)),
	CONSTRAINT "import_jobs_status_check" CHECK("__new_import_jobs"."status" IS NULL OR "__new_import_jobs"."status" IN (?, ?, ?, ?, ?)),
	CONSTRAINT "import_jobs_progress_percent_check" CHECK("__new_import_jobs"."progress_percent" >= 0 AND "__new_import_jobs"."progress_percent" <= 100),
	CONSTRAINT "import_jobs_chunks_check" CHECK("__new_import_jobs"."chunks_total" IS NULL OR "__new_import_jobs"."chunks_completed" <= "__new_import_jobs"."chunks_total"),
	CONSTRAINT "import_jobs_error_log_length_check" CHECK("__new_import_jobs"."error_log" IS NULL OR json_array_length("__new_import_jobs"."error_log") <= ?)
);
--> statement-breakpoint
INSERT INTO `__new_import_jobs`("id", "account_id", "system_id", "source", "status", "progress_percent", "error_log", "warning_count", "chunks_total", "chunks_completed", "created_at", "updated_at", "completed_at") SELECT "id", "account_id", "system_id", "source", "status", "progress_percent", "error_log", "warning_count", "chunks_total", "chunks_completed", "created_at", "updated_at", "completed_at" FROM `import_jobs`;--> statement-breakpoint
DROP TABLE `import_jobs`;--> statement-breakpoint
ALTER TABLE `__new_import_jobs` RENAME TO `import_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `import_jobs_account_id_status_idx` ON `import_jobs` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `import_jobs_system_id_idx` ON `import_jobs` (`system_id`);--> statement-breakpoint
CREATE TABLE `__new_sync_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`automerge_heads` blob,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_documents_version_check" CHECK("__new_sync_documents"."version" >= 1),
	CONSTRAINT "sync_documents_automerge_heads_size_check" CHECK("__new_sync_documents"."automerge_heads" IS NULL OR length("__new_sync_documents"."automerge_heads") <= ?)
);
--> statement-breakpoint
INSERT INTO `__new_sync_documents`("id", "system_id", "entity_type", "entity_id", "automerge_heads", "version", "created_at", "last_synced_at") SELECT "id", "system_id", "entity_type", "entity_id", "automerge_heads", "version", "created_at", "last_synced_at" FROM `sync_documents`;--> statement-breakpoint
DROP TABLE `sync_documents`;--> statement-breakpoint
ALTER TABLE `__new_sync_documents` RENAME TO `sync_documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `sync_documents_system_id_entity_type_entity_id_idx` ON `sync_documents` (`system_id`,`entity_type`,`entity_id`);