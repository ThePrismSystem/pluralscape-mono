PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_log` (
	`id` text NOT NULL,
	`account_id` text,
	`system_id` text,
	`event_type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`actor` text NOT NULL,
	`detail` text,
	PRIMARY KEY(`id`, `timestamp`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_log_event_type_check" CHECK("__new_audit_log"."event_type" IS NULL OR "__new_audit_log"."event_type" IN ('auth.register', 'auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'member.deleted', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown', 'auth.password-reset-via-recovery', 'auth.recovery-key-regenerated', 'auth.device-transfer-initiated', 'auth.device-transfer-completed', 'auth.email-changed', 'system.created', 'system.profile-updated', 'system.deleted', 'group.created', 'group.updated', 'group.archived', 'group.restored', 'group.moved', 'group-membership.added', 'group-membership.removed', 'custom-front.created', 'custom-front.updated', 'custom-front.archived', 'custom-front.restored', 'group.deleted', 'custom-front.deleted', 'auth.biometric-enrolled', 'auth.biometric-verified', 'settings.pin-set', 'settings.pin-removed', 'settings.pin-verified', 'settings.nomenclature-updated', 'setup.step-completed', 'setup.completed', 'member.updated', 'member.duplicated', 'member.restored', 'member-photo.created', 'member-photo.archived', 'member-photo.restored', 'member-photo.reordered', 'field-definition.created', 'field-definition.updated', 'field-definition.archived', 'field-definition.restored', 'field-definition.deleted', 'field-value.set', 'field-value.updated', 'field-value.deleted', 'structure-entity-type.created', 'structure-entity-type.updated', 'structure-entity-type.archived', 'structure-entity-type.restored', 'structure-entity-type.deleted', 'structure-entity.created', 'structure-entity.updated', 'structure-entity.archived', 'structure-entity.restored', 'structure-entity.deleted', 'structure-entity-link.created', 'structure-entity-link.deleted', 'structure-entity-member-link.added', 'structure-entity-member-link.removed', 'structure-entity-association.created', 'structure-entity-association.deleted', 'relationship.created', 'relationship.updated', 'relationship.archived', 'relationship.restored', 'relationship.deleted', 'lifecycle-event.created', 'lifecycle-event.archived', 'lifecycle-event.restored', 'lifecycle-event.deleted', 'timer-config.created', 'timer-config.updated', 'timer-config.archived', 'timer-config.restored', 'timer-config.deleted', 'check-in-record.created', 'check-in-record.responded', 'check-in-record.dismissed', 'check-in-record.archived', 'check-in-record.deleted', 'innerworld-region.created', 'innerworld-region.updated', 'innerworld-region.archived', 'innerworld-region.restored', 'innerworld-region.deleted', 'innerworld-entity.created', 'innerworld-entity.updated', 'innerworld-entity.archived', 'innerworld-entity.restored', 'innerworld-entity.deleted', 'innerworld-canvas.created', 'innerworld-canvas.updated', 'blob.upload-requested', 'blob.confirmed', 'blob.archived', 'fronting-report.created', 'fronting-report.deleted', 'fronting-session.created', 'fronting-session.updated', 'fronting-session.ended', 'fronting-session.archived', 'fronting-session.restored', 'fronting-session.deleted', 'fronting-comment.created', 'fronting-comment.updated', 'fronting-comment.archived', 'fronting-comment.restored', 'fronting-comment.deleted', 'webhook-config.created', 'webhook-config.updated', 'webhook-config.archived', 'webhook-config.restored', 'webhook-config.deleted', 'webhook-delivery.deleted', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend-code.generated', 'friend-code.redeemed', 'friend-code.archived', 'friend-connection.created', 'friend-connection.blocked', 'friend-connection.removed', 'friend-connection.archived', 'friend-connection.restored', 'friend-visibility.updated', 'friend-bucket-assignment.assigned', 'friend-bucket-assignment.unassigned')),
	CONSTRAINT "audit_log_detail_length_check" CHECK("__new_audit_log"."detail" IS NULL OR length("__new_audit_log"."detail") <= 2048)
);
--> statement-breakpoint
INSERT INTO `__new_audit_log`("id", "account_id", "system_id", "event_type", "timestamp", "ip_address", "user_agent", "actor", "detail") SELECT "id", "account_id", "system_id", "event_type", "timestamp", "ip_address", "user_agent", "actor", "detail" FROM `audit_log`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
ALTER TABLE `__new_audit_log` RENAME TO `audit_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_log_account_timestamp_idx` ON `audit_log` (`account_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_timestamp_idx` ON `audit_log` (`system_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_system_event_type_timestamp_idx` ON `audit_log` (`system_id`,`event_type`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_id_unique` ON `audit_log` (`id`,`timestamp`);--> statement-breakpoint
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
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`,`system_id`) REFERENCES `webhook_configs`(`id`,`system_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "webhook_deliveries_event_type_check" CHECK("__new_webhook_deliveries"."event_type" IS NULL OR "__new_webhook_deliveries"."event_type" IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'group.created', 'group.updated', 'lifecycle.event-recorded', 'custom-front.changed', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend.connected', 'friend.removed', 'friend.bucket-assigned', 'friend.bucket-unassigned')),
	CONSTRAINT "webhook_deliveries_status_check" CHECK("__new_webhook_deliveries"."status" IS NULL OR "__new_webhook_deliveries"."status" IN ('pending', 'success', 'failed')),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK("__new_webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_http_status_check" CHECK("__new_webhook_deliveries"."http_status" IS NULL OR ("__new_webhook_deliveries"."http_status" >= 100 AND "__new_webhook_deliveries"."http_status" <= 599)),
	CONSTRAINT "webhook_deliveries_archived_consistency_check" CHECK(("__new_webhook_deliveries"."archived" = true) = ("__new_webhook_deliveries"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_webhook_deliveries`("id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "payload_data", "created_at", "archived", "archived_at") SELECT "id", "webhook_id", "system_id", "event_type", "status", "http_status", "attempt_count", "last_attempt_at", "next_retry_at", "encrypted_data", "payload_data", "created_at", "archived", "archived_at" FROM `webhook_deliveries`;--> statement-breakpoint
DROP TABLE `webhook_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_webhook_deliveries` RENAME TO `webhook_deliveries`;--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_id_idx` ON `webhook_deliveries` (`system_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_next_retry_at_idx` ON `webhook_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_terminal_created_at_idx` ON `webhook_deliveries` (`created_at`) WHERE "webhook_deliveries"."status" IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX `webhook_deliveries_system_retry_idx` ON `webhook_deliveries` (`system_id`,`status`,`next_retry_at`) WHERE "webhook_deliveries"."status" NOT IN ('success', 'failed');