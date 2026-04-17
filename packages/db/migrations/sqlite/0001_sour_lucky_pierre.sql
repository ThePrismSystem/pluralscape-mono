PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
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
CREATE UNIQUE INDEX `notification_configs_system_id_event_type_idx` ON `notification_configs` (`system_id`,`event_type`) WHERE "notification_configs"."archived" = 0;