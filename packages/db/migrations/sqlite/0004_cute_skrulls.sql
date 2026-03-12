DROP INDEX `acknowledgements_system_id_idx`;--> statement-breakpoint
DROP INDEX `acknowledgements_confirmed_idx`;--> statement-breakpoint
CREATE INDEX `acknowledgements_system_id_confirmed_idx` ON `acknowledgements` (`system_id`,`confirmed`);--> statement-breakpoint
DROP INDEX `blob_metadata_system_id_idx`;--> statement-breakpoint
CREATE INDEX `blob_metadata_system_id_purpose_idx` ON `blob_metadata` (`system_id`,`purpose`);--> statement-breakpoint
DROP INDEX `bucket_content_tags_entity_idx`;--> statement-breakpoint
DROP INDEX `members_system_id_idx`;--> statement-breakpoint
DROP INDEX `members_archived_idx`;--> statement-breakpoint
CREATE INDEX `members_system_id_archived_idx` ON `members` (`system_id`,`archived`);--> statement-breakpoint
DROP INDEX `sessions_revoked_idx`;--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE INDEX `friend_bucket_assignments_bucket_id_idx` ON `friend_bucket_assignments` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `fronting_sessions_active_idx` ON `fronting_sessions` (`system_id`) WHERE "fronting_sessions"."end_time" IS NULL;