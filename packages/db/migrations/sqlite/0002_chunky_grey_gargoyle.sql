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
	CONSTRAINT "audit_log_event_type_check" CHECK("__new_audit_log"."event_type" IS NULL OR "__new_audit_log"."event_type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
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
CREATE UNIQUE INDEX `audit_log_id_unique` ON `audit_log` (`id`,`timestamp`);