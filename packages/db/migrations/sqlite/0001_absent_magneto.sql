DROP INDEX `board_messages_system_id_idx`;--> statement-breakpoint
DROP INDEX `buckets_system_id_idx`;--> statement-breakpoint
DROP INDEX `channels_system_id_idx`;--> statement-breakpoint
CREATE INDEX `channels_system_archived_idx` ON `channels` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `custom_fronts_system_id_idx`;--> statement-breakpoint
CREATE INDEX `custom_fronts_system_archived_idx` ON `custom_fronts` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `field_definitions_system_id_idx`;--> statement-breakpoint
CREATE INDEX `field_definitions_system_archived_idx` ON `field_definitions` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `groups_system_id_idx`;--> statement-breakpoint
CREATE INDEX `groups_system_archived_idx` ON `groups` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `innerworld_entities_system_id_idx`;--> statement-breakpoint
DROP INDEX `innerworld_regions_system_id_idx`;--> statement-breakpoint
DROP INDEX `layers_system_id_idx`;--> statement-breakpoint
DROP INDEX `member_photos_system_id_idx`;--> statement-breakpoint
CREATE INDEX `member_photos_system_archived_idx` ON `member_photos` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `messages_system_id_idx`;--> statement-breakpoint
CREATE INDEX `messages_system_archived_idx` ON `messages` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `notes_system_id_idx`;--> statement-breakpoint
CREATE INDEX `notes_system_archived_idx` ON `notes` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `poll_votes_system_id_idx`;--> statement-breakpoint
CREATE INDEX `poll_votes_system_archived_idx` ON `poll_votes` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `polls_system_id_idx`;--> statement-breakpoint
DROP INDEX `relationships_system_id_idx`;--> statement-breakpoint
DROP INDEX `side_systems_system_id_idx`;--> statement-breakpoint
DROP INDEX `subsystems_system_id_idx`;--> statement-breakpoint
DROP INDEX `timer_configs_system_id_idx`;--> statement-breakpoint
DROP INDEX `webhook_configs_system_id_idx`;--> statement-breakpoint
DROP INDEX `wiki_pages_system_id_idx`;--> statement-breakpoint
DROP INDEX `check_in_records_system_pending_idx`;--> statement-breakpoint
CREATE INDEX `check_in_records_system_pending_idx` ON `check_in_records` (`system_id`,`scheduled_at`) WHERE "check_in_records"."responded_at" IS NULL AND "check_in_records"."dismissed" = 0 AND "check_in_records"."archived" = 0;--> statement-breakpoint
DROP INDEX `friend_connections_account_friend_uniq`;--> statement-breakpoint
CREATE UNIQUE INDEX `friend_connections_account_friend_uniq` ON `friend_connections` (`account_id`,`friend_account_id`) WHERE "friend_connections"."archived" = 0;--> statement-breakpoint
DROP INDEX `notification_configs_system_id_event_type_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_configs_system_id_event_type_idx` ON `notification_configs` (`system_id`,`event_type`) WHERE "notification_configs"."archived" = 0;--> statement-breakpoint
CREATE INDEX `acknowledgements_system_archived_idx` ON `acknowledgements` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `blob_metadata_system_archived_idx` ON `blob_metadata` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `fronting_comments_system_archived_idx` ON `fronting_comments` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `journal_entries_system_archived_idx` ON `journal_entries` (`system_id`,`archived`);--> statement-breakpoint
CREATE INDEX `switches_system_archived_idx` ON `switches` (`system_id`,`archived`);