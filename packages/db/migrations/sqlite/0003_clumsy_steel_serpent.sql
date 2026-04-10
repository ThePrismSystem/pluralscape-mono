PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_import_entity_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`system_id` text NOT NULL,
	`source` text NOT NULL,
	`source_entity_type` text NOT NULL,
	`source_entity_id` text NOT NULL,
	`pluralscape_entity_id` text NOT NULL,
	`imported_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "import_entity_refs_source_check" CHECK("__new_import_entity_refs"."source" IS NULL OR "__new_import_entity_refs"."source" IN ('simply-plural', 'pluralkit', 'pluralscape')),
	CONSTRAINT "import_entity_refs_source_entity_type_check" CHECK("__new_import_entity_refs"."source_entity_type" IS NULL OR "__new_import_entity_refs"."source_entity_type" IN ('member', 'group', 'custom-front', 'fronting-session', 'fronting-comment', 'switch', 'custom-field', 'field-definition', 'field-value', 'note', 'journal-entry', 'chat-message', 'board-message', 'channel-category', 'channel', 'poll', 'timer', 'privacy-bucket', 'friend', 'system-profile', 'system-settings', 'unknown'))
);
--> statement-breakpoint
INSERT INTO `__new_import_entity_refs`("id", "account_id", "system_id", "source", "source_entity_type", "source_entity_id", "pluralscape_entity_id", "imported_at") SELECT "id", "account_id", "system_id", "source", "source_entity_type", "source_entity_id", "pluralscape_entity_id", "imported_at" FROM `import_entity_refs`;--> statement-breakpoint
DROP TABLE `import_entity_refs`;--> statement-breakpoint
ALTER TABLE `__new_import_entity_refs` RENAME TO `import_entity_refs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `import_entity_refs_source_unique_idx` ON `import_entity_refs` (`account_id`,`system_id`,`source`,`source_entity_type`,`source_entity_id`);--> statement-breakpoint
CREATE INDEX `import_entity_refs_pluralscape_entity_id_idx` ON `import_entity_refs` (`pluralscape_entity_id`);--> statement-breakpoint
CREATE INDEX `import_entity_refs_account_system_idx` ON `import_entity_refs` (`account_id`,`system_id`);