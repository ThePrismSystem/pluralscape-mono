CREATE INDEX `acknowledgements_system_archived_created_idx` ON `acknowledgements` (`system_id`,`archived`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `board_messages_system_archived_sort_idx` ON `board_messages` (`system_id`,`archived`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `channels_parent_id_idx` ON `channels` (`parent_id`);--> statement-breakpoint
CREATE INDEX `notes_system_archived_created_idx` ON `notes` (`system_id`,`archived`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `poll_votes_poll_created_idx` ON `poll_votes` (`poll_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `polls_system_archived_created_idx` ON `polls` (`system_id`,`archived`,`created_at`,`id`);