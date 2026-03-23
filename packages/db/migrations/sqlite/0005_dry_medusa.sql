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
	CONSTRAINT "audit_log_event_type_check" CHECK("__new_audit_log"."event_type" IS NULL OR "__new_audit_log"."event_type" IN ('auth.register', 'auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'member.deleted', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown', 'auth.password-reset-via-recovery', 'auth.recovery-key-regenerated', 'auth.device-transfer-initiated', 'auth.device-transfer-completed', 'auth.email-changed', 'system.created', 'system.profile-updated', 'system.deleted', 'group.created', 'group.updated', 'group.archived', 'group.restored', 'group.moved', 'group-membership.added', 'group-membership.removed', 'custom-front.created', 'custom-front.updated', 'custom-front.archived', 'custom-front.restored', 'group.deleted', 'custom-front.deleted', 'auth.biometric-enrolled', 'auth.biometric-verified', 'settings.pin-set', 'settings.pin-removed', 'settings.pin-verified', 'settings.nomenclature-updated', 'setup.step-completed', 'setup.completed', 'member.updated', 'member.duplicated', 'member.restored', 'member-photo.created', 'member-photo.archived', 'member-photo.restored', 'member-photo.reordered', 'field-definition.created', 'field-definition.updated', 'field-definition.archived', 'field-definition.restored', 'field-value.set', 'field-value.updated', 'field-value.deleted', 'structure-entity-type.created', 'structure-entity-type.updated', 'structure-entity-type.archived', 'structure-entity-type.restored', 'structure-entity-type.deleted', 'structure-entity.created', 'structure-entity.updated', 'structure-entity.archived', 'structure-entity.restored', 'structure-entity.deleted', 'structure-entity-link.created', 'structure-entity-link.deleted', 'structure-entity-member-link.added', 'structure-entity-member-link.removed', 'structure-entity-association.created', 'structure-entity-association.deleted', 'relationship.created', 'relationship.updated', 'relationship.archived', 'relationship.restored', 'relationship.deleted', 'lifecycle-event.created', 'lifecycle-event.archived', 'lifecycle-event.restored', 'lifecycle-event.deleted', 'timer-config.created', 'timer-config.updated', 'timer-config.archived', 'timer-config.restored', 'timer-config.deleted', 'timer-config.enabled', 'timer-config.disabled', 'check-in-record.created', 'check-in-record.responded', 'check-in-record.dismissed', 'check-in-record.archived', 'check-in-record.deleted', 'innerworld-region.created', 'innerworld-region.updated', 'innerworld-region.archived', 'innerworld-region.restored', 'innerworld-region.deleted', 'innerworld-entity.created', 'innerworld-entity.updated', 'innerworld-entity.archived', 'innerworld-entity.restored', 'innerworld-entity.deleted', 'innerworld-canvas.created', 'innerworld-canvas.updated', 'blob.upload-requested', 'blob.confirmed', 'blob.archived', 'fronting-report.created', 'fronting-report.deleted')),
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
CREATE UNIQUE INDEX `audit_log_id_unique` ON `audit_log` (`id`,`timestamp`);