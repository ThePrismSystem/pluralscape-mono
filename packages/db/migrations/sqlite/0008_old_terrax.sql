PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_webhook_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` blob NOT NULL,
	`event_types` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`crypto_key_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`crypto_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "webhook_configs_version_check" CHECK("__new_webhook_configs"."version" >= 1),
	CONSTRAINT "webhook_configs_archived_consistency_check" CHECK(("__new_webhook_configs"."archived" = true) = ("__new_webhook_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_webhook_configs`("id", "system_id", "url", "secret", "event_types", "enabled", "crypto_key_id", "created_at", "updated_at", "version", "archived", "archived_at") SELECT "id", "system_id", "url", "secret", "event_types", "enabled", "crypto_key_id", "created_at", "updated_at", "version", "archived", "archived_at" FROM `webhook_configs`;--> statement-breakpoint
DROP TABLE `webhook_configs`;--> statement-breakpoint
ALTER TABLE `__new_webhook_configs` RENAME TO `webhook_configs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `webhook_configs_system_archived_idx` ON `webhook_configs` (`system_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_configs_id_system_id_unique` ON `webhook_configs` (`id`,`system_id`);