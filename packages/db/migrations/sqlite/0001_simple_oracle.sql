PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bucket_content_tags` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `bucket_id`),
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_content_tags_entity_type_check" CHECK("__new_bucket_content_tags"."entity_type" IS NULL OR "__new_bucket_content_tags"."entity_type" IN ('member', 'group', 'channel', 'message', 'note', 'poll', 'relationship', 'structure-entity-type', 'structure-entity', 'journal-entry', 'wiki-page', 'custom-front', 'fronting-session', 'board-message', 'acknowledgement', 'innerworld-entity', 'innerworld-region', 'field-definition', 'field-value', 'member-photo', 'fronting-comment'))
);
--> statement-breakpoint
INSERT INTO `__new_bucket_content_tags`("entity_type", "entity_id", "bucket_id", "system_id") SELECT "entity_type", "entity_id", "bucket_id", "system_id" FROM `bucket_content_tags`;--> statement-breakpoint
DROP TABLE `bucket_content_tags`;--> statement-breakpoint
ALTER TABLE `__new_bucket_content_tags` RENAME TO `bucket_content_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bucket_content_tags_bucket_id_idx` ON `bucket_content_tags` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `bucket_content_tags_system_id_idx` ON `bucket_content_tags` (`system_id`);