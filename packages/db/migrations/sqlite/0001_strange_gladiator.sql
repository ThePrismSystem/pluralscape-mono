PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_configs_event_type_check" CHECK("__new_notification_configs"."event_type" IS NULL OR "__new_notification_configs"."event_type" IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
	CONSTRAINT "notification_configs_archived_consistency_check" CHECK(("__new_notification_configs"."archived" = true) = ("__new_notification_configs"."archived_at" IS NOT NULL)),
	CONSTRAINT "notification_configs_version_check" CHECK("__new_notification_configs"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_notification_configs`("id", "system_id", "event_type", "enabled", "push_enabled", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "event_type", "enabled", "push_enabled", "created_at", "updated_at", "version", "archived", "archived_at" FROM `notification_configs`;--> statement-breakpoint
DROP TABLE `notification_configs`;--> statement-breakpoint
ALTER TABLE `__new_notification_configs` RENAME TO `notification_configs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_configs_system_id_event_type_idx` ON `notification_configs` (`system_id`,`event_type`) WHERE "notification_configs"."archived" = 0;--> statement-breakpoint
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
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`,`system_id`) REFERENCES `polls`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "poll_votes_voter_not_null" CHECK("__new_poll_votes"."voter" IS NOT NULL),
	CONSTRAINT "poll_votes_archived_consistency_check" CHECK(("__new_poll_votes"."archived" = true) = ("__new_poll_votes"."archived_at" IS NOT NULL)),
	CONSTRAINT "poll_votes_version_check" CHECK("__new_poll_votes"."version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_poll_votes`("id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "poll_id", "system_id", "option_id", "voter", "is_veto", "voted_at", "encrypted_data", "created_at", "updated_at", "version", "archived", "archived_at" FROM `poll_votes`;--> statement-breakpoint
DROP TABLE `poll_votes`;--> statement-breakpoint
ALTER TABLE `__new_poll_votes` RENAME TO `poll_votes`;--> statement-breakpoint
CREATE INDEX `poll_votes_poll_id_idx` ON `poll_votes` (`poll_id`);--> statement-breakpoint
CREATE INDEX `poll_votes_poll_created_idx` ON `poll_votes` (`poll_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `poll_votes_system_archived_idx` ON `poll_votes` (`system_id`,`archived`);
