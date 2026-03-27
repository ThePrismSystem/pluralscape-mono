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
	CONSTRAINT "audit_log_event_type_check" CHECK("__new_audit_log"."event_type" IS NULL OR "__new_audit_log"."event_type" IN ('auth.register', 'auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'member.deleted', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown', 'auth.password-reset-via-recovery', 'auth.recovery-key-regenerated', 'auth.device-transfer-initiated', 'auth.device-transfer-completed', 'auth.email-changed', 'system.created', 'system.profile-updated', 'system.deleted', 'group.created', 'group.updated', 'group.archived', 'group.restored', 'group.moved', 'group-membership.added', 'group-membership.removed', 'custom-front.created', 'custom-front.updated', 'custom-front.archived', 'custom-front.restored', 'group.deleted', 'custom-front.deleted', 'auth.biometric-enrolled', 'auth.biometric-verified', 'auth.biometric-failed', 'settings.pin-set', 'settings.pin-removed', 'settings.pin-verified', 'settings.nomenclature-updated', 'setup.step-completed', 'setup.completed', 'member.updated', 'member.duplicated', 'member.restored', 'member-photo.created', 'member-photo.archived', 'member-photo.restored', 'member-photo.deleted', 'member-photo.reordered', 'field-definition.created', 'field-definition.updated', 'field-definition.archived', 'field-definition.restored', 'field-definition.deleted', 'field-value.set', 'field-value.updated', 'field-value.deleted', 'structure-entity-type.created', 'structure-entity-type.updated', 'structure-entity-type.archived', 'structure-entity-type.restored', 'structure-entity-type.deleted', 'structure-entity.created', 'structure-entity.updated', 'structure-entity.archived', 'structure-entity.restored', 'structure-entity.deleted', 'structure-entity-link.created', 'structure-entity-link.deleted', 'structure-entity-member-link.added', 'structure-entity-member-link.removed', 'structure-entity-association.created', 'structure-entity-association.deleted', 'relationship.created', 'relationship.updated', 'relationship.archived', 'relationship.restored', 'relationship.deleted', 'lifecycle-event.created', 'lifecycle-event.archived', 'lifecycle-event.restored', 'lifecycle-event.deleted', 'timer-config.created', 'timer-config.updated', 'timer-config.archived', 'timer-config.restored', 'timer-config.deleted', 'check-in-record.created', 'check-in-record.responded', 'check-in-record.dismissed', 'check-in-record.archived', 'check-in-record.deleted', 'innerworld-region.created', 'innerworld-region.updated', 'innerworld-region.archived', 'innerworld-region.restored', 'innerworld-region.deleted', 'innerworld-entity.created', 'innerworld-entity.updated', 'innerworld-entity.archived', 'innerworld-entity.restored', 'innerworld-entity.deleted', 'innerworld-canvas.created', 'innerworld-canvas.updated', 'blob.upload-requested', 'blob.confirmed', 'blob.archived', 'fronting-report.created', 'fronting-report.deleted', 'fronting-session.created', 'fronting-session.updated', 'fronting-session.ended', 'fronting-session.archived', 'fronting-session.restored', 'fronting-session.deleted', 'fronting-comment.created', 'fronting-comment.updated', 'fronting-comment.archived', 'fronting-comment.restored', 'fronting-comment.deleted', 'webhook-config.created', 'webhook-config.updated', 'webhook-config.archived', 'webhook-config.restored', 'webhook-config.deleted', 'webhook-delivery.deleted', 'channel.created', 'channel.updated', 'channel.archived', 'channel.restored', 'channel.deleted', 'message.created', 'message.updated', 'message.archived', 'message.restored', 'message.deleted', 'board-message.created', 'board-message.updated', 'board-message.pinned', 'board-message.unpinned', 'board-message.reordered', 'board-message.archived', 'board-message.restored', 'board-message.deleted', 'note.created', 'note.updated', 'note.archived', 'note.restored', 'note.deleted', 'poll.created', 'poll.updated', 'poll.closed', 'poll.archived', 'poll.restored', 'poll.deleted', 'poll-vote.cast', 'poll-vote.vetoed', 'acknowledgement.created', 'acknowledgement.confirmed', 'acknowledgement.archived', 'acknowledgement.restored', 'acknowledgement.deleted', 'bucket.created', 'bucket.updated', 'bucket.archived', 'bucket.restored', 'bucket.deleted', 'bucket-content-tag.tagged', 'bucket-content-tag.untagged', 'field-bucket-visibility.set', 'field-bucket-visibility.removed', 'friend-code.generated', 'friend-code.redeemed', 'friend-code.archived', 'friend-connection.created', 'friend-connection.blocked', 'friend-connection.removed', 'friend-connection.archived', 'friend-connection.restored', 'friend-visibility.updated', 'friend-bucket-assignment.assigned', 'friend-bucket-assignment.unassigned', 'device-token.registered', 'device-token.revoked', 'notification-config.updated', 'friend-notification-preference.updated')),
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
CREATE TABLE `__new_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`next_retry_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`idempotency_key` text,
	`last_heartbeat_at` integer,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`result` text,
	`scheduled_for` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jobs_status_check" CHECK("__new_jobs"."status" IS NULL OR "__new_jobs"."status" IN ('pending', 'running', 'completed', 'cancelled', 'dead-letter')),
	CONSTRAINT "jobs_type_check" CHECK("__new_jobs"."type" IS NULL OR "__new_jobs"."type" IN ('sync-push', 'sync-pull', 'blob-upload', 'blob-cleanup', 'export-generate', 'import-process', 'webhook-deliver', 'notification-send', 'analytics-compute', 'account-purge', 'bucket-key-rotation', 'report-generate', 'audit-log-cleanup', 'partition-maintenance', 'device-transfer-cleanup', 'sync-queue-cleanup', 'sync-compaction', 'check-in-generate')),
	CONSTRAINT "jobs_attempts_max_check" CHECK("__new_jobs"."attempts" <= "__new_jobs"."max_attempts"),
	CONSTRAINT "jobs_timeout_ms_check" CHECK("__new_jobs"."timeout_ms" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "system_id", "type", "payload", "status", "attempts", "max_attempts", "next_retry_at", "error", "created_at", "started_at", "completed_at", "idempotency_key", "last_heartbeat_at", "timeout_ms", "result", "scheduled_for", "priority") SELECT "id", "system_id", "type", "payload", "status", "attempts", "max_attempts", "next_retry_at", "error", "created_at", "started_at", "completed_at", "idempotency_key", "last_heartbeat_at", "timeout_ms", "result", "scheduled_for", "priority" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
CREATE INDEX `jobs_status_next_retry_at_idx` ON `jobs` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_idx` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_priority_status_scheduled_idx` ON `jobs` (`priority`,`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `jobs_heartbeat_idx` ON `jobs` (`status`,`last_heartbeat_at`);