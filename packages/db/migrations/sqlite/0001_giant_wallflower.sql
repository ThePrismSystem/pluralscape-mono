PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_device_transfer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`source_session_id` text NOT NULL,
	`target_session_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`encrypted_key_material` blob,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "device_transfer_requests_status_check" CHECK("__new_device_transfer_requests"."status" IS NULL OR "__new_device_transfer_requests"."status" IN (?, ?, ?)),
	CONSTRAINT "device_transfer_requests_expires_at_check" CHECK("__new_device_transfer_requests"."expires_at" > "__new_device_transfer_requests"."created_at"),
	CONSTRAINT "device_transfer_requests_key_material_check" CHECK("__new_device_transfer_requests"."status" != 'approved' OR "__new_device_transfer_requests"."encrypted_key_material" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_device_transfer_requests`("id", "account_id", "source_session_id", "target_session_id", "status", "encrypted_key_material", "created_at", "expires_at") SELECT "id", "account_id", "source_session_id", "target_session_id", "status", "encrypted_key_material", "created_at", "expires_at" FROM `device_transfer_requests`;--> statement-breakpoint
DROP TABLE `device_transfer_requests`;--> statement-breakpoint
ALTER TABLE `__new_device_transfer_requests` RENAME TO `device_transfer_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `device_transfer_requests_account_status_idx` ON `device_transfer_requests` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `device_transfer_requests_status_expires_idx` ON `device_transfer_requests` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device_info` text,
	`created_at` integer NOT NULL,
	`last_active` integer,
	`revoked` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessions_expires_at_check" CHECK("__new_sessions"."expires_at" IS NULL OR "__new_sessions"."expires_at" > "__new_sessions"."created_at")
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "account_id", "device_info", "created_at", "last_active", "revoked", "expires_at") SELECT "id", "account_id", "device_info", "created_at", "last_active", "revoked", "expires_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE INDEX `sessions_account_id_idx` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `sessions_revoked_idx` ON `sessions` (`revoked`);--> statement-breakpoint
CREATE INDEX `sessions_revoked_last_active_idx` ON `sessions` (`revoked`,`last_active`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);