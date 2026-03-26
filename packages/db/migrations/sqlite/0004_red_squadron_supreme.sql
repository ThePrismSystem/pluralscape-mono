PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`system_id` text NOT NULL,
	`option_id` text,
	`voter` text,
	`is_veto` integer DEFAULT false NOT NULL,
	`voted_at` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`created_at` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`,`system_id`) REFERENCES `polls`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "poll_votes_archived_consistency_check" CHECK(("__new_poll_votes"."archived" = true) = ("__new_poll_votes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_poll_votes`("id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at", "archived", "archived_at") SELECT "id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at", "archived", "archived_at" FROM `poll_votes`;--> statement-breakpoint
DROP TABLE `poll_votes`;--> statement-breakpoint
ALTER TABLE `__new_poll_votes` RENAME TO `poll_votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `poll_votes_poll_id_idx` ON `poll_votes` (`poll_id`);--> statement-breakpoint
CREATE INDEX `poll_votes_poll_created_idx` ON `poll_votes` (`poll_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `poll_votes_system_archived_idx` ON `poll_votes` (`system_id`,`archived`);