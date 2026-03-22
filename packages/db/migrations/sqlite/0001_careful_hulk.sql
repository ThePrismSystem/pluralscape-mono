PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fronting_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`member_id` text,
	`custom_front_id` text,
	`structure_entity_id` text,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`structure_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fronting_sessions_end_time_check" CHECK("__new_fronting_sessions"."end_time" IS NULL OR "__new_fronting_sessions"."end_time" > "__new_fronting_sessions"."start_time"),
	CONSTRAINT "fronting_sessions_version_check" CHECK("__new_fronting_sessions"."version" >= 1),
	CONSTRAINT "fronting_sessions_archived_consistency_check" CHECK(("__new_fronting_sessions"."archived" = true) = ("__new_fronting_sessions"."archived_at" IS NOT NULL)),
	CONSTRAINT "fronting_sessions_subject_check" CHECK(("__new_fronting_sessions"."member_id" IS NOT NULL OR "__new_fronting_sessions"."custom_front_id" IS NOT NULL OR "__new_fronting_sessions"."structure_entity_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_fronting_sessions`("id", "system_id", "start_time", "end_time", "member_id", "custom_front_id", "structure_entity_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "start_time", "end_time", "member_id", "custom_front_id", "structure_entity_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `fronting_sessions`;--> statement-breakpoint
DROP TABLE `fronting_sessions`;--> statement-breakpoint
ALTER TABLE `__new_fronting_sessions` RENAME TO `fronting_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_start_idx` ON `fronting_sessions` (`system_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_member_start_idx` ON `fronting_sessions` (`system_id`,`member_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_end_idx` ON `fronting_sessions` (`system_id`,`end_time`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_active_idx` ON `fronting_sessions` (`system_id`) WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_archived_idx` ON `fronting_sessions` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_system_entity_start_idx` ON `fronting_sessions` (`system_id`,`structure_entity_id`,`start_time`);--> statement-breakpoint
CREATE UNIQUE INDEX `fronting_sessions_id_system_id_unique` ON `fronting_sessions` (`id`,`system_id`);--> statement-breakpoint
DROP INDEX `system_structure_entity_associations_source_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_associations_target_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_associations_system_id_idx`;--> statement-breakpoint
CREATE INDEX `system_structure_entity_associations_system_source_idx` ON `system_structure_entity_associations` (`system_id`,`source_entity_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_associations_system_target_idx` ON `system_structure_entity_associations` (`system_id`,`target_entity_id`);--> statement-breakpoint
DROP INDEX `system_structure_entity_links_entity_id_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_links_parent_entity_id_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_links_system_id_idx`;--> statement-breakpoint
CREATE INDEX `system_structure_entity_links_system_entity_idx` ON `system_structure_entity_links` (`system_id`,`entity_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_links_system_parent_idx` ON `system_structure_entity_links` (`system_id`,`parent_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_links_entity_root_uniq` ON `system_structure_entity_links` (`entity_id`) WHERE "system_structure_entity_links"."parent_entity_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_links_entity_parent_uniq` ON `system_structure_entity_links` (`entity_id`,`parent_entity_id`);--> statement-breakpoint
DROP INDEX `system_structure_entity_member_links_parent_entity_id_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_member_links_member_id_idx`;--> statement-breakpoint
DROP INDEX `system_structure_entity_member_links_system_id_idx`;--> statement-breakpoint
CREATE INDEX `system_structure_entity_member_links_system_member_idx` ON `system_structure_entity_member_links` (`system_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `system_structure_entity_member_links_system_parent_idx` ON `system_structure_entity_member_links` (`system_id`,`parent_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_member_links_member_root_uniq` ON `system_structure_entity_member_links` (`member_id`) WHERE "system_structure_entity_member_links"."parent_entity_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `system_structure_entity_member_links_member_parent_uniq` ON `system_structure_entity_member_links` (`member_id`,`parent_entity_id`);