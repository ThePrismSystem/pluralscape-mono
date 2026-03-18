PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_layer_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`layer_id` text NOT NULL,
	`member_id` text NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`layer_id`,`system_id`) REFERENCES `layers`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_layer_memberships`("id", "layer_id", "member_id", "system_id", "encrypted_data", "created_at") SELECT "id", "layer_id", "member_id", "system_id", "encrypted_data", "created_at" FROM `layer_memberships`;--> statement-breakpoint
DROP TABLE `layer_memberships`;--> statement-breakpoint
ALTER TABLE `__new_layer_memberships` RENAME TO `layer_memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `layer_memberships_layer_id_idx` ON `layer_memberships` (`layer_id`);--> statement-breakpoint
CREATE INDEX `layer_memberships_member_id_idx` ON `layer_memberships` (`member_id`);--> statement-breakpoint
CREATE INDEX `layer_memberships_system_id_idx` ON `layer_memberships` (`system_id`);--> statement-breakpoint
CREATE TABLE `__new_side_system_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`side_system_id` text NOT NULL,
	`member_id` text NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`side_system_id`,`system_id`) REFERENCES `side_systems`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_side_system_memberships`("id", "side_system_id", "member_id", "system_id", "encrypted_data", "created_at") SELECT "id", "side_system_id", "member_id", "system_id", "encrypted_data", "created_at" FROM `side_system_memberships`;--> statement-breakpoint
DROP TABLE `side_system_memberships`;--> statement-breakpoint
ALTER TABLE `__new_side_system_memberships` RENAME TO `side_system_memberships`;--> statement-breakpoint
CREATE INDEX `side_system_memberships_side_system_id_idx` ON `side_system_memberships` (`side_system_id`);--> statement-breakpoint
CREATE INDEX `side_system_memberships_member_id_idx` ON `side_system_memberships` (`member_id`);--> statement-breakpoint
CREATE INDEX `side_system_memberships_system_id_idx` ON `side_system_memberships` (`system_id`);--> statement-breakpoint
CREATE TABLE `__new_subsystem_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`subsystem_id` text NOT NULL,
	`member_id` text NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subsystem_id`,`system_id`) REFERENCES `subsystems`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_subsystem_memberships`("id", "subsystem_id", "member_id", "system_id", "encrypted_data", "created_at") SELECT "id", "subsystem_id", "member_id", "system_id", "encrypted_data", "created_at" FROM `subsystem_memberships`;--> statement-breakpoint
DROP TABLE `subsystem_memberships`;--> statement-breakpoint
ALTER TABLE `__new_subsystem_memberships` RENAME TO `subsystem_memberships`;--> statement-breakpoint
CREATE INDEX `subsystem_memberships_subsystem_id_idx` ON `subsystem_memberships` (`subsystem_id`);--> statement-breakpoint
CREATE INDEX `subsystem_memberships_member_id_idx` ON `subsystem_memberships` (`member_id`);--> statement-breakpoint
CREATE INDEX `subsystem_memberships_system_id_idx` ON `subsystem_memberships` (`system_id`);