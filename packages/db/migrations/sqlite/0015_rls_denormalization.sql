-- Denormalize system_id onto 6 join-based tables for direct RLS evaluation.
-- Avoids JOIN subqueries in RLS policies (O(1) vs O(log n) per row access).
-- Pre-release: no production data; backfill populates system_id from parent table.
-- SQLite does not support ALTER TABLE ADD COLUMN with FK, so recreate pattern is used.
PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- bucket_content_tags
CREATE TABLE `__new_bucket_content_tags` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `bucket_id`),
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_content_tags_entity_type_check" CHECK("__new_bucket_content_tags"."entity_type" IS NULL OR "__new_bucket_content_tags"."entity_type" IN ('member', 'group', 'channel', 'message', 'note', 'poll', 'relationship', 'subsystem', 'side-system', 'layer', 'journal-entry', 'wiki-page', 'custom-front', 'fronting-session', 'board-message', 'acknowledgement', 'innerworld-entity', 'innerworld-region', 'field-definition', 'field-value', 'member-photo', 'fronting-comment'))
);
--> statement-breakpoint
INSERT INTO `__new_bucket_content_tags`("entity_type", "entity_id", "bucket_id", "system_id") SELECT t."entity_type", t."entity_id", t."bucket_id", b."system_id" FROM `bucket_content_tags` t JOIN `buckets` b ON b."id" = t."bucket_id";--> statement-breakpoint
DROP TABLE `bucket_content_tags`;--> statement-breakpoint
ALTER TABLE `__new_bucket_content_tags` RENAME TO `bucket_content_tags`;--> statement-breakpoint

-- key_grants
CREATE TABLE `__new_key_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	`friend_system_id` text NOT NULL,
	`encrypted_key` blob NOT NULL,
	`key_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "key_grants_key_version_check" CHECK("__new_key_grants"."key_version" >= 1),
	UNIQUE("bucket_id", "friend_system_id", "key_version")
);
--> statement-breakpoint
INSERT INTO `__new_key_grants`("id", "bucket_id", "system_id", "friend_system_id", "encrypted_key", "key_version", "created_at", "revoked_at") SELECT t."id", t."bucket_id", b."system_id", t."friend_system_id", t."encrypted_key", t."key_version", t."created_at", t."revoked_at" FROM `key_grants` t JOIN `buckets` b ON b."id" = t."bucket_id";--> statement-breakpoint
DROP TABLE `key_grants`;--> statement-breakpoint
ALTER TABLE `__new_key_grants` RENAME TO `key_grants`;--> statement-breakpoint

-- friend_bucket_assignments
CREATE TABLE `__new_friend_bucket_assignments` (
	`friend_connection_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`friend_connection_id`, `bucket_id`),
	FOREIGN KEY (`friend_connection_id`) REFERENCES `friend_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_friend_bucket_assignments`("friend_connection_id", "bucket_id", "system_id") SELECT t."friend_connection_id", t."bucket_id", b."system_id" FROM `friend_bucket_assignments` t JOIN `buckets` b ON b."id" = t."bucket_id";--> statement-breakpoint
DROP TABLE `friend_bucket_assignments`;--> statement-breakpoint
ALTER TABLE `__new_friend_bucket_assignments` RENAME TO `friend_bucket_assignments`;--> statement-breakpoint

-- field_bucket_visibility
CREATE TABLE `__new_field_bucket_visibility` (
	`field_definition_id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	PRIMARY KEY(`field_definition_id`, `bucket_id`),
	FOREIGN KEY (`field_definition_id`) REFERENCES `field_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_field_bucket_visibility`("field_definition_id", "bucket_id", "system_id") SELECT t."field_definition_id", t."bucket_id", b."system_id" FROM `field_bucket_visibility` t JOIN `buckets` b ON b."id" = t."bucket_id";--> statement-breakpoint
DROP TABLE `field_bucket_visibility`;--> statement-breakpoint
ALTER TABLE `__new_field_bucket_visibility` RENAME TO `field_bucket_visibility`;--> statement-breakpoint

-- bucket_key_rotations (must be done before bucket_rotation_items so JOIN can use system_id)
CREATE TABLE `__new_bucket_key_rotations` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`system_id` text NOT NULL,
	`from_key_version` integer NOT NULL,
	`to_key_version` integer NOT NULL,
	`state` text DEFAULT 'initiated' NOT NULL,
	`initiated_at` integer NOT NULL,
	`completed_at` integer,
	`total_items` integer NOT NULL,
	`completed_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_key_rotations_state_check" CHECK("__new_bucket_key_rotations"."state" IS NULL OR "__new_bucket_key_rotations"."state" IN ('initiated', 'migrating', 'sealing', 'completed', 'failed')),
	CONSTRAINT "bucket_key_rotations_version_check" CHECK("__new_bucket_key_rotations"."to_key_version" > "__new_bucket_key_rotations"."from_key_version"),
	CONSTRAINT "bucket_key_rotations_items_check" CHECK("__new_bucket_key_rotations"."completed_items" + "__new_bucket_key_rotations"."failed_items" <= "__new_bucket_key_rotations"."total_items")
);
--> statement-breakpoint
INSERT INTO `__new_bucket_key_rotations`("id", "bucket_id", "system_id", "from_key_version", "to_key_version", "state", "initiated_at", "completed_at", "total_items", "completed_items", "failed_items") SELECT t."id", t."bucket_id", b."system_id", t."from_key_version", t."to_key_version", t."state", t."initiated_at", t."completed_at", t."total_items", t."completed_items", t."failed_items" FROM `bucket_key_rotations` t JOIN `buckets` b ON b."id" = t."bucket_id";--> statement-breakpoint
DROP TABLE `bucket_key_rotations`;--> statement-breakpoint
ALTER TABLE `__new_bucket_key_rotations` RENAME TO `bucket_key_rotations`;--> statement-breakpoint

-- bucket_rotation_items (JOINs already-migrated bucket_key_rotations for system_id)
CREATE TABLE `__new_bucket_rotation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`rotation_id` text NOT NULL,
	`system_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`claimed_by` text,
	`claimed_at` integer,
	`completed_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`rotation_id`) REFERENCES `bucket_key_rotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_rotation_items_status_check" CHECK("__new_bucket_rotation_items"."status" IS NULL OR "__new_bucket_rotation_items"."status" IN ('pending', 'claimed', 'completed', 'failed'))
);
--> statement-breakpoint
INSERT INTO `__new_bucket_rotation_items`("id", "rotation_id", "system_id", "entity_type", "entity_id", "status", "claimed_by", "claimed_at", "completed_at", "attempts") SELECT t."id", t."rotation_id", bkr."system_id", t."entity_type", t."entity_id", t."status", t."claimed_by", t."claimed_at", t."completed_at", t."attempts" FROM `bucket_rotation_items` t JOIN `bucket_key_rotations` bkr ON bkr."id" = t."rotation_id";--> statement-breakpoint
DROP TABLE `bucket_rotation_items`;--> statement-breakpoint
ALTER TABLE `__new_bucket_rotation_items` RENAME TO `bucket_rotation_items`;--> statement-breakpoint

PRAGMA foreign_keys=ON;--> statement-breakpoint

-- Recreate indexes for bucket_content_tags
CREATE INDEX `bucket_content_tags_bucket_id_idx` ON `bucket_content_tags` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `bucket_content_tags_system_id_idx` ON `bucket_content_tags` (`system_id`);--> statement-breakpoint

-- Recreate indexes for key_grants
CREATE INDEX `key_grants_system_id_idx` ON `key_grants` (`system_id`);--> statement-breakpoint
CREATE INDEX `key_grants_friend_bucket_idx` ON `key_grants` (`friend_system_id`,`bucket_id`);--> statement-breakpoint
CREATE INDEX `key_grants_revoked_at_idx` ON `key_grants` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `key_grants_friend_revoked_idx` ON `key_grants` (`friend_system_id`,`revoked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `key_grants_bucket_friend_version_uniq` ON `key_grants` (`bucket_id`,`friend_system_id`,`key_version`);--> statement-breakpoint

-- Recreate indexes for friend_bucket_assignments
CREATE INDEX `friend_bucket_assignments_bucket_id_idx` ON `friend_bucket_assignments` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `friend_bucket_assignments_system_id_idx` ON `friend_bucket_assignments` (`system_id`);--> statement-breakpoint

-- Recreate indexes for field_bucket_visibility
CREATE INDEX `field_bucket_visibility_bucket_id_idx` ON `field_bucket_visibility` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `field_bucket_visibility_system_id_idx` ON `field_bucket_visibility` (`system_id`);--> statement-breakpoint

-- Recreate indexes for bucket_key_rotations
CREATE INDEX `bucket_key_rotations_bucket_state_idx` ON `bucket_key_rotations` (`bucket_id`,`state`);--> statement-breakpoint
CREATE INDEX `bucket_key_rotations_system_id_idx` ON `bucket_key_rotations` (`system_id`);--> statement-breakpoint

-- Recreate indexes for bucket_rotation_items
CREATE INDEX `bucket_rotation_items_rotation_status_idx` ON `bucket_rotation_items` (`rotation_id`,`status`);--> statement-breakpoint
CREATE INDEX `bucket_rotation_items_status_claimed_by_idx` ON `bucket_rotation_items` (`status`,`claimed_by`);--> statement-breakpoint
CREATE INDEX `bucket_rotation_items_system_id_idx` ON `bucket_rotation_items` (`system_id`);
