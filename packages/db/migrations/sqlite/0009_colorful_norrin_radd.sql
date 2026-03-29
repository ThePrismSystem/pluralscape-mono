PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`system_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`http_status` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`next_retry_at` integer,
	`encrypted_data` blob,
	`payload_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`,`system_id`) REFERENCES `webhook_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "webhook_deliveries_event_type_check" CHECK("__new_webhook_deliveries"."event_type" IS NULL OR "__new_webhook_deliveries"."event_type" IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'group.created', 'group.updated', 'lifecycle.event-recorded', 'custom-front.changed', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend.connected', 'friend.removed', 'friend.bucket-assigned', 'friend.bucket-unassigned')),
	CONSTRAINT "webhook_deliveries_status_check" CHECK("__new_webhook_deliveries"."status" IS NULL OR "__new_webhook_deliveries"."status" IN ('pending', 'success', 'failed')),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK("__new_webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_payload_check" CHECK("__new_webhook_deliveries"."encrypted_data" IS NOT NULL OR "__new_webhook_deliveries"."payload_data" IS NOT NULL),
	CONSTRAINT "webhook_deliveries_http_status_check" CHECK("__new_webhook_deliveries"."http_status" IS NULL OR ("__new_webhook_deliveries"."http_status" >= 100 AND "__new_webhook_deliveries"."http_status" <= 599)),
	CONSTRAINT "webhook_deliveries_payload_presence_check" CHECK("__new_webhook_deliveries"."encrypted_data" IS NOT NULL OR "__new_webhook_deliveries"."payload_data" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_webhook_deliveries`("id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "payload_data", "created_at") SELECT "id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "payload_data", "created_at" FROM `webhook_deliveries`;--> statement-breakpoint
DROP TABLE `webhook_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_webhook_deliveries` RENAME TO `webhook_deliveries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_id_idx` ON `webhook_deliveries` (`system_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_next_retry_at_idx` ON `webhook_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_terminal_created_at_idx` ON `webhook_deliveries` (`created_at`) WHERE "webhook_deliveries"."status" IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_retry_idx` ON `webhook_deliveries` (`system_id`,`status`,`next_retry_at`) WHERE "webhook_deliveries"."status" NOT IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX `webhook_deliveries_pending_retry_idx` ON `webhook_deliveries` (`next_retry_at`) WHERE "webhook_deliveries"."status" = 'pending';