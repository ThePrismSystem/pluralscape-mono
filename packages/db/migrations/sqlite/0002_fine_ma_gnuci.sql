PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fronting_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`fronting_session_id` text NOT NULL,
	`system_id` text NOT NULL,
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
	FOREIGN KEY (`fronting_session_id`,`system_id`) REFERENCES `fronting_sessions`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`,`system_id`) REFERENCES `members`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`custom_front_id`) REFERENCES `custom_fronts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`structure_entity_id`,`system_id`) REFERENCES `system_structure_entities`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fronting_comments_version_check" CHECK("__new_fronting_comments"."version" >= 1),
	CONSTRAINT "fronting_comments_archived_consistency_check" CHECK(("__new_fronting_comments"."archived" = true) = ("__new_fronting_comments"."archived_at" IS NOT NULL)),
	CONSTRAINT "fronting_comments_author_check" CHECK(("__new_fronting_comments"."member_id" IS NOT NULL OR "__new_fronting_comments"."custom_front_id" IS NOT NULL OR "__new_fronting_comments"."structure_entity_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_fronting_comments`("id", "fronting_session_id", "system_id", "member_id", "custom_front_id", "structure_entity_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "fronting_session_id", "system_id", "member_id", "custom_front_id", "structure_entity_id", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `fronting_comments`;--> statement-breakpoint
DROP TABLE `fronting_comments`;--> statement-breakpoint
ALTER TABLE `__new_fronting_comments` RENAME TO `fronting_comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `fronting_comments_session_created_idx` ON `fronting_comments` (`fronting_session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `fronting_comments_system_archived_idx` ON `fronting_comments` (`system_id`,`archived`);