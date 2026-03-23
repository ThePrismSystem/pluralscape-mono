PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`encrypted_data` blob NOT NULL,
	`plaintext_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lifecycle_events_event_type_check" CHECK("__new_lifecycle_events"."event_type" IS NULL OR "__new_lifecycle_events"."event_type" IN ('split', 'fusion', 'merge', 'unmerge', 'dormancy-start', 'dormancy-end', 'discovery', 'archival', 'structure-entity-formation', 'form-change', 'name-change', 'structure-move', 'innerworld-move')),
	CONSTRAINT "lifecycle_events_version_check" CHECK("__new_lifecycle_events"."version" >= 1),
	CONSTRAINT "lifecycle_events_archived_consistency_check" CHECK(("__new_lifecycle_events"."archived" = true) = ("__new_lifecycle_events"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_lifecycle_events`("id", "system_id", "event_type", "occurred_at", "recorded_at", "updated_at", "encrypted_data", "plaintext_metadata", "version", "archived", "archived_at") SELECT "id", "system_id", "event_type", "occurred_at", "recorded_at", "recorded_at", "encrypted_data", "plaintext_metadata", 1, 0, NULL FROM `lifecycle_events`;--> statement-breakpoint
DROP TABLE `lifecycle_events`;--> statement-breakpoint
ALTER TABLE `__new_lifecycle_events` RENAME TO `lifecycle_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_occurred_idx` ON `lifecycle_events` (`system_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_recorded_idx` ON `lifecycle_events` (`system_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `lifecycle_events_system_archived_idx` ON `lifecycle_events` (`system_id`,`archived`);