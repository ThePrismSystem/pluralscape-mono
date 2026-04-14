ALTER TABLE `timer_configs` ADD `next_check_in_at` integer;--> statement-breakpoint
CREATE INDEX `timer_configs_next_check_in_idx` ON `timer_configs` (`next_check_in_at`) WHERE "timer_configs"."enabled" = 1 AND "timer_configs"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX `timer_configs_enabled_active_idx` ON `timer_configs` (`enabled`) WHERE "timer_configs"."archived_at" IS NULL;