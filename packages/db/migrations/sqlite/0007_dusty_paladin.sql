PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_acknowledgements` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`created_by_member_id` text,
	`confirmed` integer DEFAULT false NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_acknowledgements`("id", "system_id", "created_by_member_id", "confirmed", "encrypted_data", "created_at") SELECT "id", "system_id", "created_by_member_id", "confirmed", "encrypted_data", "created_at" FROM `acknowledgements`;--> statement-breakpoint
DROP TABLE `acknowledgements`;--> statement-breakpoint
ALTER TABLE `__new_acknowledgements` RENAME TO `acknowledgements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `acknowledgements_system_id_confirmed_idx` ON `acknowledgements` (`system_id`,`confirmed`);--> statement-breakpoint
CREATE TABLE `__new_channels` (
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
	FOREIGN KEY (`parent_id`,`system_id`) REFERENCES `channels`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "channels_type_check" CHECK("__new_channels"."type" IS NULL OR "__new_channels"."type" IN (?, ?)),
	CONSTRAINT "channels_sort_order_check" CHECK("__new_channels"."sort_order" >= 0),
	CONSTRAINT "channels_version_check" CHECK("__new_channels"."version" >= 1),
	CONSTRAINT "channels_archived_consistency_check" CHECK(("__new_channels"."archived" = true) = ("__new_channels"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_channels`("id", "system_id", "type", "parent_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "type", "parent_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `channels`;--> statement-breakpoint
DROP TABLE `channels`;--> statement-breakpoint
ALTER TABLE `__new_channels` RENAME TO `channels`;--> statement-breakpoint
CREATE INDEX `channels_system_id_idx` ON `channels` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `channels_id_system_id_unique` ON `channels` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_check_in_records` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`timer_config_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`responded_at` integer,
	`dismissed` integer DEFAULT false NOT NULL,
	`responded_by_member_id` text,
	`encrypted_data` blob,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`timer_config_id`,`system_id`) REFERENCES `timer_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responded_by_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_check_in_records`("id", "system_id", "timer_config_id", "scheduled_at", "responded_at", "dismissed", "responded_by_member_id", "encrypted_data") SELECT "id", "system_id", "timer_config_id", "scheduled_at", "responded_at", "dismissed", "responded_by_member_id", "encrypted_data" FROM `check_in_records`;--> statement-breakpoint
DROP TABLE `check_in_records`;--> statement-breakpoint
ALTER TABLE `__new_check_in_records` RENAME TO `check_in_records`;--> statement-breakpoint
CREATE INDEX `check_in_records_system_id_idx` ON `check_in_records` (`system_id`);--> statement-breakpoint
CREATE INDEX `check_in_records_timer_config_id_idx` ON `check_in_records` (`timer_config_id`);--> statement-breakpoint
CREATE INDEX `check_in_records_scheduled_at_idx` ON `check_in_records` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `__new_groups` (
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
	FOREIGN KEY (`parent_group_id`,`system_id`) REFERENCES `groups`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "groups_sort_order_check" CHECK("__new_groups"."sort_order" >= 0),
	CONSTRAINT "groups_version_check" CHECK("__new_groups"."version" >= 1),
	CONSTRAINT "groups_archived_consistency_check" CHECK(("__new_groups"."archived" = true) = ("__new_groups"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_groups`("id", "system_id", "parent_group_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "parent_group_id", "sort_order", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `groups`;--> statement-breakpoint
DROP TABLE `groups`;--> statement-breakpoint
ALTER TABLE `__new_groups` RENAME TO `groups`;--> statement-breakpoint
CREATE INDEX `groups_system_id_idx` ON `groups` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_id_system_id_unique` ON `groups` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_innerworld_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_region_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_region_id`,`system_id`) REFERENCES `innerworld_regions`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "innerworld_regions_version_check" CHECK("__new_innerworld_regions"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_innerworld_regions`("id", "system_id", "parent_region_id", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "parent_region_id", "encrypted_data", "created_at", "updated_at", "version" FROM `innerworld_regions`;--> statement-breakpoint
DROP TABLE `innerworld_regions`;--> statement-breakpoint
ALTER TABLE `__new_innerworld_regions` RENAME TO `innerworld_regions`;--> statement-breakpoint
CREATE INDEX `innerworld_regions_system_id_idx` ON `innerworld_regions` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `innerworld_regions_id_system_id_unique` ON `innerworld_regions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`member_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "notes_version_check" CHECK("__new_notes"."version" >= 1),
	CONSTRAINT "notes_archived_consistency_check" CHECK(("__new_notes"."archived" = true) = ("__new_notes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "system_id", "member_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "member_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `notes`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;--> statement-breakpoint
CREATE INDEX `notes_system_id_idx` ON `notes` (`system_id`);--> statement-breakpoint
CREATE INDEX `notes_member_id_idx` ON `notes` (`member_id`);--> statement-breakpoint
CREATE TABLE `__new_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`created_by_member_id` text,
	`kind` text,
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
CREATE TABLE `__new_subsystems` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`parent_subsystem_id` text,
	`architecture_type` text,
	`has_core` integer,
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
CREATE TABLE `__new_api_keys` (
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
	CONSTRAINT "api_keys_key_type_check" CHECK("__new_api_keys"."key_type" IS NULL OR "__new_api_keys"."key_type" IN (?, ?)),
	CONSTRAINT "api_keys_key_material_check" CHECK(("__new_api_keys"."key_type" = 'crypto' AND "__new_api_keys"."encrypted_key_material" IS NOT NULL) OR ("__new_api_keys"."key_type" = 'metadata' AND "__new_api_keys"."encrypted_key_material" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "account_id", "system_id", "key_type", "token_hash", "scopes", "encrypted_data", "encrypted_key_material", "created_at", "last_used_at", "revoked_at", "expires_at", "scoped_bucket_ids") SELECT "id", "account_id", "system_id", "key_type", "token_hash", "scopes", "encrypted_data", "encrypted_key_material", "created_at", "last_used_at", "revoked_at", "expires_at", "scoped_bucket_ids" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
CREATE INDEX `api_keys_account_id_idx` ON `api_keys` (`account_id`);--> statement-breakpoint
CREATE INDEX `api_keys_system_id_idx` ON `api_keys` (`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_idx` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_revoked_at_idx` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `api_keys_key_type_idx` ON `api_keys` (`key_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_token_platform_unique` ON `device_tokens` (`token`,`platform`);--> statement-breakpoint
CREATE INDEX `friend_connections_friend_status_idx` ON `friend_connections` (`friend_system_id`,`status`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_member_start_idx` ON `fronting_sessions` (`system_id`,`member_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `key_grants_friend_revoked_idx` ON `key_grants` (`friend_system_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `wiki_pages_system_archived_idx` ON `wiki_pages` (`system_id`,`archived`);--> statement-breakpoint
CREATE TABLE `__new_friend_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "friend_codes_expires_at_check" CHECK("__new_friend_codes"."expires_at" IS NULL OR "__new_friend_codes"."expires_at" > "__new_friend_codes"."created_at"),
	CONSTRAINT "friend_codes_code_min_length_check" CHECK(length("__new_friend_codes"."code") >= 8)
);
--> statement-breakpoint
INSERT INTO `__new_friend_codes`("id", "system_id", "code", "created_at", "expires_at") SELECT "id", "system_id", "code", "created_at", "expires_at" FROM `friend_codes`;--> statement-breakpoint
DROP TABLE `friend_codes`;--> statement-breakpoint
ALTER TABLE `__new_friend_codes` RENAME TO `friend_codes`;--> statement-breakpoint
CREATE UNIQUE INDEX `friend_codes_code_unique` ON `friend_codes` (`code`);--> statement-breakpoint
CREATE INDEX `friend_codes_system_id_idx` ON `friend_codes` (`system_id`);