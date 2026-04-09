CREATE TABLE `import_entity_refs` (
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
	CONSTRAINT "import_entity_refs_source_check" CHECK("import_entity_refs"."source" IS NULL OR "import_entity_refs"."source" IN ('simply-plural', 'pluralkit', 'pluralscape')),
	CONSTRAINT "import_entity_refs_source_entity_type_check" CHECK("import_entity_refs"."source_entity_type" IS NULL OR "import_entity_refs"."source_entity_type" IN ('member', 'group', 'fronting-session', 'switch', 'custom-field', 'note', 'chat-message', 'board-message', 'poll', 'timer', 'privacy-bucket', 'friend', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_entity_refs_source_unique_idx` ON `import_entity_refs` (`account_id`,`system_id`,`source`,`source_entity_type`,`source_entity_id`);--> statement-breakpoint
CREATE INDEX `import_entity_refs_pluralscape_entity_id_idx` ON `import_entity_refs` (`pluralscape_entity_id`);--> statement-breakpoint
CREATE INDEX `import_entity_refs_account_system_idx` ON `import_entity_refs` (`account_id`,`system_id`);--> statement-breakpoint
ALTER TABLE `import_jobs` ADD `checkpoint_state` text;