PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_wiki_pages` (
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
	CONSTRAINT "wiki_pages_version_check" CHECK("__new_wiki_pages"."version" >= 1),
	CONSTRAINT "wiki_pages_archived_consistency_check" CHECK(("__new_wiki_pages"."archived" = true) = ("__new_wiki_pages"."archived_at" IS NOT NULL)),
	CONSTRAINT "wiki_pages_slug_hash_length_check" CHECK(length("__new_wiki_pages"."slug_hash") = 64)
);
--> statement-breakpoint
INSERT INTO `__new_wiki_pages`("id", "system_id", "slug_hash", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "slug_hash", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `wiki_pages`;--> statement-breakpoint
DROP TABLE `wiki_pages`;--> statement-breakpoint
ALTER TABLE `__new_wiki_pages` RENAME TO `wiki_pages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `wiki_pages_system_id_idx` ON `wiki_pages` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_pages_system_id_slug_hash_idx` ON `wiki_pages` (`system_id`,`slug_hash`);--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`name` text,
	`key_type` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`encrypted_data` blob,
	`encrypted_key_material` blob,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`expires_at` integer,
	`scoped_bucket_ids` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_keys_key_type_check" CHECK("__new_api_keys"."key_type" IS NULL OR "__new_api_keys"."key_type" IN (?, ?)),
	CONSTRAINT "api_keys_key_material_check" CHECK(("__new_api_keys"."key_type" = 'crypto' AND "__new_api_keys"."encrypted_key_material" IS NOT NULL) OR ("__new_api_keys"."key_type" = 'metadata' AND "__new_api_keys"."encrypted_key_material" IS NULL)),
	CONSTRAINT "api_keys_name_or_encrypted_data_check" CHECK("__new_api_keys"."name" IS NOT NULL OR "__new_api_keys"."encrypted_data" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "account_id", "system_id", "name", "key_type", "token_hash", "scopes", "encrypted_data", "encrypted_key_material", "created_at", "last_used_at", "revoked_at", "expires_at", "scoped_bucket_ids") SELECT "id", "account_id", "system_id", "name", "key_type", "token_hash", "scopes", "encrypted_data", "encrypted_key_material", "created_at", "last_used_at", "revoked_at", "expires_at", "scoped_bucket_ids" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
CREATE INDEX `api_keys_account_id_idx` ON `api_keys` (`account_id`);--> statement-breakpoint
CREATE INDEX `api_keys_system_id_idx` ON `api_keys` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_idx` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_revoked_at_idx` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `api_keys_key_type_idx` ON `api_keys` (`key_type`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `encrypted_data` blob;--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_created_at_idx` ON `webhook_deliveries` (`status`,`created_at`);