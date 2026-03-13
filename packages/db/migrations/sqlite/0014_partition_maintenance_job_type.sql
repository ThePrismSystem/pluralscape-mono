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
	CONSTRAINT "jobs_status_check" CHECK("__new_jobs"."status" IS NULL OR "__new_jobs"."status" IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'dead-letter')),
	CONSTRAINT "jobs_type_check" CHECK("__new_jobs"."type" IS NULL OR "__new_jobs"."type" IN ('sync-push', 'sync-pull', 'blob-upload', 'blob-cleanup', 'export-generate', 'import-process', 'webhook-deliver', 'notification-send', 'analytics-compute', 'account-purge', 'bucket-key-rotation', 'report-generate', 'sync-queue-cleanup', 'audit-log-cleanup', 'partition-maintenance')),
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
CREATE INDEX `jobs_heartbeat_idx` ON `jobs` (`status`,`last_heartbeat_at`);
