PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fronting_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	`format` text NOT NULL,
	`generated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fronting_reports_format_check" CHECK("__new_fronting_reports"."format" IS NULL OR "__new_fronting_reports"."format" IN ('html', 'pdf')),
	CONSTRAINT "fronting_reports_version_check" CHECK("__new_fronting_reports"."version" >= 1),
	CONSTRAINT "fronting_reports_archived_consistency_check" CHECK(("__new_fronting_reports"."archived" = true) = ("__new_fronting_reports"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_fronting_reports`("id", "system_id", "encrypted_data", "format", "generated_at", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "encrypted_data", "format", "generated_at", "created_at", "updated_at", "version", "archived", "archived_at" FROM `fronting_reports`;--> statement-breakpoint
DROP TABLE `fronting_reports`;--> statement-breakpoint
ALTER TABLE `__new_fronting_reports` RENAME TO `fronting_reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `fronting_reports_system_id_idx` ON `fronting_reports` (`system_id`);