PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`field_definition_id` text NOT NULL,
	`member_id` text,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_definition_id`,`system_id`) REFERENCES `field_definitions`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "field_values_version_check" CHECK("__new_field_values"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_field_values`("id", "field_definition_id", "member_id", "system_id", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "field_definition_id", "member_id", "system_id", "encrypted_data", "created_at", "updated_at", "version" FROM `field_values`;--> statement-breakpoint
DROP TABLE `field_values`;--> statement-breakpoint
ALTER TABLE `__new_field_values` RENAME TO `field_values`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `field_values_definition_system_idx` ON `field_values` (`field_definition_id`,`system_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_member_uniq` ON `field_values` (`field_definition_id`,`member_id`) WHERE "field_values"."member_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `field_values_definition_system_uniq` ON `field_values` (`field_definition_id`,`system_id`) WHERE "field_values"."member_id" IS NULL;--> statement-breakpoint
CREATE TABLE `__new_fronting_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`fronting_session_id` text NOT NULL,
	`system_id` text NOT NULL,
	`member_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fronting_session_id`,`system_id`) REFERENCES `fronting_sessions`(`id`,`system_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "fronting_comments_version_check" CHECK("__new_fronting_comments"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_fronting_comments`("id", "fronting_session_id", "system_id", "member_id", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "fronting_session_id", "system_id", "member_id", "encrypted_data", "created_at", "updated_at", "version" FROM `fronting_comments`;--> statement-breakpoint
DROP TABLE `fronting_comments`;--> statement-breakpoint
ALTER TABLE `__new_fronting_comments` RENAME TO `fronting_comments`;--> statement-breakpoint
CREATE INDEX `fronting_comments_session_created_idx` ON `fronting_comments` (`fronting_session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_fronting_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`member_id` text,
	`fronting_type` text,
	`custom_front_id` text,
	`linked_structure` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "fronting_sessions_end_time_check" CHECK("__new_fronting_sessions"."end_time" IS NULL OR "__new_fronting_sessions"."end_time" > "__new_fronting_sessions"."start_time"),
	CONSTRAINT "fronting_sessions_fronting_type_check" CHECK("__new_fronting_sessions"."fronting_type" IS NULL OR "__new_fronting_sessions"."fronting_type" IN (?, ?)),
	CONSTRAINT "fronting_sessions_version_check" CHECK("__new_fronting_sessions"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_fronting_sessions`("id", "system_id", "start_time", "end_time", "member_id", "fronting_type", "custom_front_id", "linked_structure", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "start_time", "end_time", "member_id", "fronting_type", "custom_front_id", "linked_structure", "encrypted_data", "created_at", "updated_at", "version" FROM `fronting_sessions`;--> statement-breakpoint
DROP TABLE `fronting_sessions`;--> statement-breakpoint
ALTER TABLE `__new_fronting_sessions` RENAME TO `fronting_sessions`;--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_start_idx` ON `fronting_sessions` (`system_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_member_start_idx` ON `fronting_sessions` (`system_id`,`member_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_end_idx` ON `fronting_sessions` (`system_id`,`end_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_active_idx` ON `fronting_sessions` (`system_id`) WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `fronting_sessions_id_system_id_unique` ON `fronting_sessions` (`id`,`system_id`);--> statement-breakpoint
CREATE TABLE `__new_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`source_member_id` text,
	`target_member_id` text,
	`type` text,
	`bidirectional` integer,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "relationships_type_check" CHECK("__new_relationships"."type" IS NULL OR "__new_relationships"."type" IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)),
	CONSTRAINT "relationships_version_check" CHECK("__new_relationships"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_relationships`("id", "system_id", "source_member_id", "target_member_id", "type", "bidirectional", "encrypted_data", "created_at", "updated_at", "version") SELECT "id", "system_id", "source_member_id", "target_member_id", "type", "bidirectional", "encrypted_data", "created_at", "updated_at", "version" FROM `relationships`;--> statement-breakpoint
DROP TABLE `relationships`;--> statement-breakpoint
ALTER TABLE `__new_relationships` RENAME TO `relationships`;--> statement-breakpoint
CREATE INDEX `relationships_system_id_idx` ON `relationships` (`system_id`);--> statement-breakpoint
DROP INDEX `friend_connections_friend_system_id_idx`;