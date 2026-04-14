PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_type` text DEFAULT 'system' NOT NULL,
	`email_hash` text NOT NULL,
	`email_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`kdf_salt` text NOT NULL,
	`encrypted_master_key` blob NOT NULL,
	`encrypted_email` blob,
	`audit_log_ip_tracking` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounts_account_type_check" CHECK("__new_accounts"."account_type" IS NULL OR "__new_accounts"."account_type" IN ('system', 'viewer')),
	CONSTRAINT "accounts_version_check" CHECK("__new_accounts"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "account_type", "email_hash", "email_salt", "password_hash", "kdf_salt", "encrypted_master_key", "encrypted_email", "audit_log_ip_tracking", "created_at", "updated_at", "version") SELECT "id", "account_type", "email_hash", "email_salt", "password_hash", "kdf_salt", "encrypted_master_key", "encrypted_email", "audit_log_ip_tracking", "created_at", "updated_at", "version" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_hash_idx` ON `accounts` (`email_hash`);--> statement-breakpoint
ALTER TABLE `timer_configs` ADD `next_check_in_at` integer;--> statement-breakpoint
CREATE INDEX `timer_configs_next_check_in_idx` ON `timer_configs` (`next_check_in_at`) WHERE "timer_configs"."enabled" = 1 AND "timer_configs"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX `timer_configs_enabled_active_idx` ON `timer_configs` (`enabled`) WHERE "timer_configs"."archived_at" IS NULL;