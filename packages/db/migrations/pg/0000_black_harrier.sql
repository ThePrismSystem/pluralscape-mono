CREATE TABLE "account_purge_requests" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"confirmation_phrase" varchar(255) NOT NULL,
	"scheduled_purge_at" timestamptz NOT NULL,
	"requested_at" timestamptz NOT NULL,
	"confirmed_at" timestamptz,
	"completed_at" timestamptz,
	"cancelled_at" timestamptz,
	CONSTRAINT "account_purge_requests_status_check" CHECK ("account_purge_requests"."status" IS NULL OR "account_purge_requests"."status" IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_type" varchar(50) DEFAULT 'system' NOT NULL,
	"email_hash" varchar(255) NOT NULL,
	"email_salt" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"kdf_salt" varchar(255) NOT NULL,
	"encrypted_master_key" "bytea",
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounts_account_type_check" CHECK ("accounts"."account_type" IS NULL OR "accounts"."account_type" IN ('system', 'viewer')),
	CONSTRAINT "accounts_version_check" CHECK ("accounts"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "acknowledgements" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"created_by_member_id" varchar(50),
	"confirmed" boolean DEFAULT false NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "acknowledgements_archived_consistency_check" CHECK (("acknowledgements"."archived" = true) = ("acknowledgements"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"key_type" varchar(50) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"scopes" jsonb NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"encrypted_key_material" "bytea",
	"created_at" timestamptz NOT NULL,
	"last_used_at" timestamptz,
	"revoked_at" timestamptz,
	"expires_at" timestamptz,
	"scoped_bucket_ids" jsonb,
	CONSTRAINT "api_keys_key_type_check" CHECK ("api_keys"."key_type" IS NULL OR "api_keys"."key_type" IN ('metadata', 'crypto')),
	CONSTRAINT "api_keys_key_material_check" CHECK (("api_keys"."key_type" = 'crypto' AND "api_keys"."encrypted_key_material" IS NOT NULL) OR ("api_keys"."key_type" = 'metadata' AND "api_keys"."encrypted_key_material" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(50) NOT NULL,
	"account_id" varchar(50),
	"system_id" varchar(50),
	"event_type" varchar(50) NOT NULL,
	"timestamp" timestamptz NOT NULL,
	"ip_address" varchar(255),
	"user_agent" varchar(1024),
	"actor" jsonb NOT NULL,
	"detail" text,
	CONSTRAINT "audit_log_id_timestamp_pk" PRIMARY KEY("id","timestamp"),
	CONSTRAINT "audit_log_id_unique" UNIQUE("id","timestamp"),
	CONSTRAINT "audit_log_event_type_check" CHECK ("audit_log"."event_type" IS NULL OR "audit_log"."event_type" IN ('auth.register', 'auth.login', 'auth.login-failed', 'auth.logout', 'auth.password-changed', 'auth.recovery-key-used', 'auth.key-created', 'auth.key-revoked', 'data.export', 'data.import', 'data.purge', 'settings.changed', 'member.created', 'member.archived', 'member.deleted', 'sharing.granted', 'sharing.revoked', 'bucket.key_rotation.initiated', 'bucket.key_rotation.chunk_completed', 'bucket.key_rotation.completed', 'bucket.key_rotation.failed', 'device.security.jailbreak_warning_shown', 'auth.password-reset-via-recovery', 'auth.recovery-key-regenerated', 'auth.device-transfer-initiated', 'auth.device-transfer-completed', 'auth.email-changed', 'system.created', 'system.profile-updated', 'system.deleted', 'group.created', 'group.updated', 'group.archived', 'group.restored', 'group.moved', 'group-membership.added', 'group-membership.removed', 'custom-front.created', 'custom-front.updated', 'custom-front.archived', 'custom-front.restored', 'group.deleted', 'custom-front.deleted', 'auth.biometric-enrolled', 'auth.biometric-verified', 'settings.pin-set', 'settings.pin-removed', 'settings.pin-verified', 'settings.nomenclature-updated', 'setup.step-completed', 'setup.completed', 'member.updated', 'member.duplicated', 'member.restored', 'member-photo.created', 'member-photo.archived', 'member-photo.restored', 'member-photo.reordered', 'field-definition.created', 'field-definition.updated', 'field-definition.archived', 'field-definition.restored', 'field-value.set', 'field-value.updated', 'field-value.deleted', 'subsystem.created', 'subsystem.updated', 'subsystem.archived', 'subsystem.restored', 'subsystem.deleted', 'side-system.created', 'side-system.updated', 'side-system.archived', 'side-system.restored', 'side-system.deleted', 'layer.created', 'layer.updated', 'layer.archived', 'layer.restored', 'layer.deleted', 'relationship.created', 'relationship.updated', 'relationship.archived', 'relationship.restored', 'relationship.deleted', 'lifecycle-event.created', 'subsystem-membership.added', 'subsystem-membership.removed', 'side-system-membership.added', 'side-system-membership.removed', 'layer-membership.added', 'layer-membership.removed', 'structure-link.created', 'structure-link.deleted', 'innerworld-region.created', 'innerworld-region.updated', 'innerworld-region.archived', 'innerworld-region.restored', 'innerworld-region.deleted', 'innerworld-entity.created', 'innerworld-entity.updated', 'innerworld-entity.archived', 'innerworld-entity.restored', 'innerworld-entity.deleted', 'innerworld-canvas.created', 'innerworld-canvas.updated', 'blob.upload-requested', 'blob.confirmed', 'blob.archived')),
	CONSTRAINT "audit_log_detail_length_check" CHECK ("audit_log"."detail" IS NULL OR length("audit_log"."detail") <= 2048)
);
--> statement-breakpoint
CREATE TABLE "auth_keys" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"encrypted_private_key" "bytea" NOT NULL,
	"public_key" "bytea" NOT NULL,
	"key_type" varchar(50) NOT NULL,
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "auth_keys_key_type_check" CHECK ("auth_keys"."key_type" IS NULL OR "auth_keys"."key_type" IN ('encryption', 'signing'))
);
--> statement-breakpoint
CREATE TABLE "biometric_tokens" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"session_id" varchar(50) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blob_metadata" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"storage_key" varchar(1024) NOT NULL,
	"mime_type" varchar(255),
	"size_bytes" bigint NOT NULL,
	"encryption_tier" integer NOT NULL,
	"bucket_id" varchar(50),
	"purpose" varchar(50) NOT NULL,
	"thumbnail_of_blob_id" varchar(50),
	"checksum" varchar(255),
	"created_at" timestamptz NOT NULL,
	"uploaded_at" timestamptz,
	"expires_at" timestamptz,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "blob_metadata_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "blob_metadata_purpose_check" CHECK ("blob_metadata"."purpose" IS NULL OR "blob_metadata"."purpose" IN ('avatar', 'member-photo', 'journal-image', 'attachment', 'export', 'littles-safe-mode')),
	CONSTRAINT "blob_metadata_size_bytes_check" CHECK ("blob_metadata"."size_bytes" > 0),
	CONSTRAINT "blob_metadata_size_bytes_max_check" CHECK ("blob_metadata"."size_bytes" <= 10737418240),
	CONSTRAINT "blob_metadata_encryption_tier_check" CHECK ("blob_metadata"."encryption_tier" IN (1, 2)),
	CONSTRAINT "blob_metadata_checksum_length_check" CHECK ("blob_metadata"."checksum" IS NULL OR length("blob_metadata"."checksum") = 64),
	CONSTRAINT "blob_metadata_pending_consistency_check" CHECK (("blob_metadata"."checksum" IS NULL) = ("blob_metadata"."uploaded_at" IS NULL)),
	CONSTRAINT "blob_metadata_archived_consistency_check" CHECK (("blob_metadata"."archived" = true) = ("blob_metadata"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "board_messages" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "board_messages_sort_order_check" CHECK ("board_messages"."sort_order" >= 0),
	CONSTRAINT "board_messages_version_check" CHECK ("board_messages"."version" >= 1),
	CONSTRAINT "board_messages_archived_consistency_check" CHECK (("board_messages"."archived" = true) = ("board_messages"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "bucket_content_tags" (
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50) NOT NULL,
	"bucket_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	CONSTRAINT "bucket_content_tags_entity_type_entity_id_bucket_id_pk" PRIMARY KEY("entity_type","entity_id","bucket_id"),
	CONSTRAINT "bucket_content_tags_entity_type_check" CHECK ("bucket_content_tags"."entity_type" IS NULL OR "bucket_content_tags"."entity_type" IN ('member', 'group', 'channel', 'message', 'note', 'poll', 'relationship', 'subsystem', 'side-system', 'layer', 'journal-entry', 'wiki-page', 'custom-front', 'fronting-session', 'board-message', 'acknowledgement', 'innerworld-entity', 'innerworld-region', 'field-definition', 'field-value', 'member-photo', 'fronting-comment'))
);
--> statement-breakpoint
CREATE TABLE "bucket_key_rotations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"bucket_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"from_key_version" integer NOT NULL,
	"to_key_version" integer NOT NULL,
	"state" varchar(50) DEFAULT 'initiated' NOT NULL,
	"initiated_at" timestamptz NOT NULL,
	"completed_at" timestamptz,
	"total_items" integer NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bucket_key_rotations_state_check" CHECK ("bucket_key_rotations"."state" IS NULL OR "bucket_key_rotations"."state" IN ('initiated', 'migrating', 'sealing', 'completed', 'failed')),
	CONSTRAINT "bucket_key_rotations_version_check" CHECK ("bucket_key_rotations"."to_key_version" > "bucket_key_rotations"."from_key_version"),
	CONSTRAINT "bucket_key_rotations_items_check" CHECK ("bucket_key_rotations"."completed_items" + "bucket_key_rotations"."failed_items" <= "bucket_key_rotations"."total_items")
);
--> statement-breakpoint
CREATE TABLE "bucket_rotation_items" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"rotation_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"claimed_by" varchar(255),
	"claimed_at" timestamptz,
	"completed_at" timestamptz,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bucket_rotation_items_status_check" CHECK ("bucket_rotation_items"."status" IS NULL OR "bucket_rotation_items"."status" IN ('pending', 'claimed', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "buckets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "buckets_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "buckets_version_check" CHECK ("buckets"."version" >= 1),
	CONSTRAINT "buckets_archived_consistency_check" CHECK (("buckets"."archived" = true) = ("buckets"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"parent_id" varchar(50),
	"sort_order" integer NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "channels_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "channels_type_check" CHECK ("channels"."type" IS NULL OR "channels"."type" IN ('category', 'channel')),
	CONSTRAINT "channels_sort_order_check" CHECK ("channels"."sort_order" >= 0),
	CONSTRAINT "channels_version_check" CHECK ("channels"."version" >= 1),
	CONSTRAINT "channels_archived_consistency_check" CHECK (("channels"."archived" = true) = ("channels"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "check_in_records" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"timer_config_id" varchar(50) NOT NULL,
	"scheduled_at" timestamptz NOT NULL,
	"responded_at" timestamptz,
	"dismissed" boolean DEFAULT false NOT NULL,
	"responded_by_member_id" varchar(50),
	"encrypted_data" "bytea",
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "check_in_records_archived_consistency_check" CHECK (("check_in_records"."archived" = true) = ("check_in_records"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "custom_fronts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "custom_fronts_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "custom_fronts_version_check" CHECK ("custom_fronts"."version" >= 1),
	CONSTRAINT "custom_fronts_archived_consistency_check" CHECK (("custom_fronts"."archived" = true) = ("custom_fronts"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"token" varchar(512) NOT NULL,
	"created_at" timestamptz NOT NULL,
	"last_active_at" timestamptz,
	"revoked_at" timestamptz,
	CONSTRAINT "device_tokens_token_platform_unique" UNIQUE("token","platform"),
	CONSTRAINT "device_tokens_platform_check" CHECK ("device_tokens"."platform" IS NULL OR "device_tokens"."platform" IN ('ios', 'android', 'web'))
);
--> statement-breakpoint
CREATE TABLE "device_transfer_requests" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"source_session_id" varchar(50) NOT NULL,
	"target_session_id" varchar(50),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"encrypted_key_material" "bytea",
	"code_salt" "bytea" NOT NULL,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz NOT NULL,
	"expires_at" timestamptz NOT NULL,
	CONSTRAINT "device_transfer_requests_status_check" CHECK ("device_transfer_requests"."status" IS NULL OR "device_transfer_requests"."status" IN ('pending', 'approved', 'expired')),
	CONSTRAINT "device_transfer_requests_expires_at_check" CHECK ("device_transfer_requests"."expires_at" > "device_transfer_requests"."created_at"),
	CONSTRAINT "device_transfer_requests_key_material_check" CHECK ("device_transfer_requests"."status" != 'approved' OR "device_transfer_requests"."encrypted_key_material" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "export_requests" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"format" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"blob_id" varchar(50),
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"completed_at" timestamptz,
	CONSTRAINT "export_requests_format_check" CHECK ("export_requests"."format" IS NULL OR "export_requests"."format" IN ('json', 'csv')),
	CONSTRAINT "export_requests_status_check" CHECK ("export_requests"."status" IS NULL OR "export_requests"."status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "field_bucket_visibility" (
	"field_definition_id" varchar(50) NOT NULL,
	"bucket_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	CONSTRAINT "field_bucket_visibility_field_definition_id_bucket_id_pk" PRIMARY KEY("field_definition_id","bucket_id")
);
--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "field_definitions_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "field_definitions_field_type_check" CHECK ("field_definitions"."field_type" IS NULL OR "field_definitions"."field_type" IN ('text', 'number', 'boolean', 'date', 'color', 'select', 'multi-select', 'url')),
	CONSTRAINT "field_definitions_version_check" CHECK ("field_definitions"."version" >= 1),
	CONSTRAINT "field_definitions_archived_consistency_check" CHECK (("field_definitions"."archived" = true) = ("field_definitions"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "field_values" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"field_definition_id" varchar(50) NOT NULL,
	"member_id" varchar(50),
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "field_values_version_check" CHECK ("field_values"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "friend_bucket_assignments" (
	"friend_connection_id" varchar(50) NOT NULL,
	"bucket_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	CONSTRAINT "friend_bucket_assignments_friend_connection_id_bucket_id_pk" PRIMARY KEY("friend_connection_id","bucket_id")
);
--> statement-breakpoint
CREATE TABLE "friend_codes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"code" varchar(255) NOT NULL,
	"created_at" timestamptz NOT NULL,
	"expires_at" timestamptz,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "friend_codes_expires_at_check" CHECK ("friend_codes"."expires_at" IS NULL OR "friend_codes"."expires_at" > "friend_codes"."created_at"),
	CONSTRAINT "friend_codes_code_min_length_check" CHECK (length("friend_codes"."code") >= 8),
	CONSTRAINT "friend_codes_archived_consistency_check" CHECK (("friend_codes"."archived" = true) = ("friend_codes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "friend_connections" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"friend_account_id" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "friend_connections_id_account_id_unique" UNIQUE("id","account_id"),
	CONSTRAINT "friend_connections_status_check" CHECK ("friend_connections"."status" IS NULL OR "friend_connections"."status" IN ('pending', 'accepted', 'blocked', 'removed')),
	CONSTRAINT "friend_connections_no_self_check" CHECK ("friend_connections"."account_id" != "friend_connections"."friend_account_id"),
	CONSTRAINT "friend_connections_version_check" CHECK ("friend_connections"."version" >= 1),
	CONSTRAINT "friend_connections_archived_consistency_check" CHECK (("friend_connections"."archived" = true) = ("friend_connections"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "friend_notification_preferences" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"friend_connection_id" varchar(50) NOT NULL,
	"enabled_event_types" jsonb NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "friend_notification_preferences_archived_consistency_check" CHECK (("friend_notification_preferences"."archived" = true) = ("friend_notification_preferences"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fronting_comments" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"fronting_session_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"session_start_time" timestamptz NOT NULL,
	"member_id" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "fronting_comments_version_check" CHECK ("fronting_comments"."version" >= 1),
	CONSTRAINT "fronting_comments_archived_consistency_check" CHECK (("fronting_comments"."archived" = true) = ("fronting_comments"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fronting_reports" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"format" varchar(50) NOT NULL,
	"generated_at" timestamptz NOT NULL,
	CONSTRAINT "fronting_reports_format_check" CHECK ("fronting_reports"."format" IS NULL OR "fronting_reports"."format" IN ('html', 'pdf'))
);
--> statement-breakpoint
CREATE TABLE "fronting_sessions" (
	"id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"start_time" timestamptz NOT NULL,
	"end_time" timestamptz,
	"member_id" varchar(50),
	"fronting_type" varchar(50) DEFAULT 'fronting' NOT NULL,
	"custom_front_id" varchar(50),
	"linked_structure" jsonb,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "fronting_sessions_id_start_time_pk" PRIMARY KEY("id","start_time"),
	CONSTRAINT "fronting_sessions_id_system_id_unique" UNIQUE("id","system_id","start_time"),
	CONSTRAINT "fronting_sessions_end_time_check" CHECK ("fronting_sessions"."end_time" IS NULL OR "fronting_sessions"."end_time" > "fronting_sessions"."start_time"),
	CONSTRAINT "fronting_sessions_fronting_type_check" CHECK ("fronting_sessions"."fronting_type" IS NULL OR "fronting_sessions"."fronting_type" IN ('fronting', 'co-conscious')),
	CONSTRAINT "fronting_sessions_version_check" CHECK ("fronting_sessions"."version" >= 1),
	CONSTRAINT "fronting_sessions_archived_consistency_check" CHECK (("fronting_sessions"."archived" = true) = ("fronting_sessions"."archived_at" IS NOT NULL)),
	CONSTRAINT "fronting_sessions_subject_check" CHECK ("fronting_sessions"."member_id" IS NOT NULL OR "fronting_sessions"."custom_front_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"group_id" varchar(50) NOT NULL,
	"member_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "group_memberships_group_id_member_id_pk" PRIMARY KEY("group_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"parent_group_id" varchar(50),
	"sort_order" integer NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "groups_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "groups_sort_order_check" CHECK ("groups"."sort_order" >= 0),
	CONSTRAINT "groups_version_check" CHECK ("groups"."version" >= 1),
	CONSTRAINT "groups_archived_consistency_check" CHECK (("groups"."archived" = true) = ("groups"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"source" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"error_log" jsonb,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"chunks_total" integer,
	"chunks_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"completed_at" timestamptz,
	CONSTRAINT "import_jobs_source_check" CHECK ("import_jobs"."source" IS NULL OR "import_jobs"."source" IN ('simply-plural', 'pluralkit', 'pluralscape')),
	CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" IS NULL OR "import_jobs"."status" IN ('pending', 'validating', 'importing', 'completed', 'failed')),
	CONSTRAINT "import_jobs_progress_percent_check" CHECK ("import_jobs"."progress_percent" >= 0 AND "import_jobs"."progress_percent" <= 100),
	CONSTRAINT "import_jobs_chunks_check" CHECK ("import_jobs"."chunks_total" IS NULL OR "import_jobs"."chunks_completed" <= "import_jobs"."chunks_total"),
	CONSTRAINT "import_jobs_error_log_length_check" CHECK ("import_jobs"."error_log" IS NULL OR jsonb_array_length("import_jobs"."error_log") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "innerworld_canvas" (
	"system_id" varchar(50) PRIMARY KEY NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "innerworld_canvas_version_check" CHECK ("innerworld_canvas"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "innerworld_entities" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"region_id" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "innerworld_entities_version_check" CHECK ("innerworld_entities"."version" >= 1),
	CONSTRAINT "innerworld_entities_archived_consistency_check" CHECK (("innerworld_entities"."archived" = true) = ("innerworld_entities"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "innerworld_regions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"parent_region_id" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "innerworld_regions_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "innerworld_regions_version_check" CHECK ("innerworld_regions"."version" >= 1),
	CONSTRAINT "innerworld_regions_archived_consistency_check" CHECK (("innerworld_regions"."archived" = true) = ("innerworld_regions"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"fronting_session_id" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "journal_entries_version_check" CHECK ("journal_entries"."version" >= 1),
	CONSTRAINT "journal_entries_archived_consistency_check" CHECK (("journal_entries"."archived" = true) = ("journal_entries"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "key_grants" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"bucket_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"friend_account_id" varchar(50) NOT NULL,
	"encrypted_key" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamptz NOT NULL,
	"revoked_at" timestamptz,
	CONSTRAINT "key_grants_bucket_friend_version_uniq" UNIQUE("bucket_id","friend_account_id","key_version"),
	CONSTRAINT "key_grants_key_version_check" CHECK ("key_grants"."key_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "layer_memberships" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"layer_id" varchar(50) NOT NULL,
	"member_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"sort_order" integer NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "layers_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "layers_version_check" CHECK ("layers"."version" >= 1),
	CONSTRAINT "layers_archived_consistency_check" CHECK (("layers"."archived" = true) = ("layers"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "lifecycle_events" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"occurred_at" timestamptz NOT NULL,
	"recorded_at" timestamptz NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"plaintext_metadata" jsonb,
	CONSTRAINT "lifecycle_events_event_type_check" CHECK ("lifecycle_events"."event_type" IS NULL OR "lifecycle_events"."event_type" IN ('split', 'fusion', 'merge', 'unmerge', 'dormancy-start', 'dormancy-end', 'discovery', 'archival', 'subsystem-formation', 'form-change', 'name-change', 'structure-move', 'innerworld-move'))
);
--> statement-breakpoint
CREATE TABLE "member_photos" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"member_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "member_photos_version_check" CHECK ("member_photos"."version" >= 1),
	CONSTRAINT "member_photos_archived_consistency_check" CHECK (("member_photos"."archived" = true) = ("member_photos"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "members_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "members_version_check" CHECK ("members"."version" >= 1),
	CONSTRAINT "members_archived_consistency_check" CHECK (("members"."archived" = true) = ("members"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(50) NOT NULL,
	"channel_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"reply_to_id" varchar(50),
	"timestamp" timestamptz NOT NULL,
	"edited_at" timestamptz,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "messages_id_timestamp_pk" PRIMARY KEY("id","timestamp"),
	CONSTRAINT "messages_id_unique" UNIQUE("id","timestamp"),
	CONSTRAINT "messages_id_system_id_timestamp_unique" UNIQUE("id","system_id","timestamp"),
	CONSTRAINT "messages_version_check" CHECK ("messages"."version" >= 1),
	CONSTRAINT "messages_archived_consistency_check" CHECK (("messages"."archived" = true) = ("messages"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "nomenclature_settings" (
	"system_id" varchar(50) PRIMARY KEY NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "nomenclature_settings_version_check" CHECK ("nomenclature_settings"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"member_id" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "notes_version_check" CHECK ("notes"."version" >= 1),
	CONSTRAINT "notes_archived_consistency_check" CHECK (("notes"."archived" = true) = ("notes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "notification_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "notification_configs_event_type_check" CHECK ("notification_configs"."event_type" IS NULL OR "notification_configs"."event_type" IN ('switch-reminder', 'check-in-due', 'acknowledgement-requested', 'message-received', 'sync-conflict', 'friend-switch-alert')),
	CONSTRAINT "notification_configs_archived_consistency_check" CHECK (("notification_configs"."archived" = true) = ("notification_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pk_bridge_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sync_direction" varchar(50) NOT NULL,
	"pk_token_encrypted" "bytea" NOT NULL,
	"entity_mappings" "bytea" NOT NULL,
	"error_log" "bytea" NOT NULL,
	"last_sync_at" timestamptz,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pk_bridge_configs_sync_direction_check" CHECK ("pk_bridge_configs"."sync_direction" IS NULL OR "pk_bridge_configs"."sync_direction" IN ('ps-to-pk', 'pk-to-ps', 'bidirectional')),
	CONSTRAINT "pk_bridge_configs_version_check" CHECK ("pk_bridge_configs"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"poll_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"option_id" varchar(50),
	"voter" jsonb,
	"is_veto" boolean DEFAULT false NOT NULL,
	"voted_at" timestamptz,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "poll_votes_archived_consistency_check" CHECK (("poll_votes"."archived" = true) = ("poll_votes"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"created_by_member_id" varchar(50),
	"kind" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"closed_at" timestamptz,
	"ends_at" timestamptz,
	"allow_multiple_votes" boolean NOT NULL,
	"max_votes_per_member" integer NOT NULL,
	"allow_abstain" boolean NOT NULL,
	"allow_veto" boolean NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "polls_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "polls_status_check" CHECK ("polls"."status" IS NULL OR "polls"."status" IN ('open', 'closed')),
	CONSTRAINT "polls_kind_check" CHECK ("polls"."kind" IS NULL OR "polls"."kind" IN ('standard', 'custom')),
	CONSTRAINT "polls_max_votes_check" CHECK ("polls"."max_votes_per_member" >= 1),
	CONSTRAINT "polls_version_check" CHECK ("polls"."version" >= 1),
	CONSTRAINT "polls_archived_consistency_check" CHECK (("polls"."archived" = true) = ("polls"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "recovery_keys" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"encrypted_master_key" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"revoked_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"source_member_id" varchar(50),
	"target_member_id" varchar(50),
	"type" varchar(50) NOT NULL,
	"bidirectional" boolean DEFAULT false NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "relationships_type_check" CHECK ("relationships"."type" IS NULL OR "relationships"."type" IN ('split-from', 'fused-from', 'sibling', 'partner', 'parent-child', 'protector-of', 'caretaker-of', 'gatekeeper-of', 'source', 'custom')),
	CONSTRAINT "relationships_version_check" CHECK ("relationships"."version" >= 1),
	CONSTRAINT "relationships_archived_consistency_check" CHECK (("relationships"."archived" = true) = ("relationships"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "safe_mode_content" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "safe_mode_content_version_check" CHECK ("safe_mode_content"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	"last_active" timestamptz,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamptz,
	CONSTRAINT "sessions_expires_at_check" CHECK ("sessions"."expires_at" IS NULL OR "sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "side_system_layer_links" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"side_system_id" varchar(50) NOT NULL,
	"layer_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "side_system_layer_links_uniq" UNIQUE("side_system_id","layer_id")
);
--> statement-breakpoint
CREATE TABLE "side_system_memberships" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"side_system_id" varchar(50) NOT NULL,
	"member_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE "side_systems" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "side_systems_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "side_systems_version_check" CHECK ("side_systems"."version" >= 1),
	CONSTRAINT "side_systems_archived_consistency_check" CHECK (("side_systems"."archived" = true) = ("side_systems"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "subsystem_layer_links" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"subsystem_id" varchar(50) NOT NULL,
	"layer_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "subsystem_layer_links_uniq" UNIQUE("subsystem_id","layer_id")
);
--> statement-breakpoint
CREATE TABLE "subsystem_memberships" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"subsystem_id" varchar(50) NOT NULL,
	"member_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsystem_side_system_links" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"subsystem_id" varchar(50) NOT NULL,
	"side_system_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "subsystem_side_system_links_uniq" UNIQUE("subsystem_id","side_system_id")
);
--> statement-breakpoint
CREATE TABLE "subsystems" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"parent_subsystem_id" varchar(50),
	"architecture_type" jsonb,
	"has_core" boolean DEFAULT false NOT NULL,
	"discovery_status" varchar(50),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "subsystems_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "subsystems_discovery_status_check" CHECK ("subsystems"."discovery_status" IS NULL OR "subsystems"."discovery_status" IN ('fully-mapped', 'partially-mapped', 'unknown')),
	CONSTRAINT "subsystems_version_check" CHECK ("subsystems"."version" >= 1),
	CONSTRAINT "subsystems_archived_consistency_check" CHECK (("subsystems"."archived" = true) = ("subsystems"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "switches" (
	"id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"timestamp" timestamptz NOT NULL,
	"member_ids" jsonb NOT NULL,
	"created_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "switches_id_timestamp_pk" PRIMARY KEY("id","timestamp"),
	CONSTRAINT "switches_member_ids_check" CHECK (jsonb_array_length("switches"."member_ids") >= 1),
	CONSTRAINT "switches_version_check" CHECK ("switches"."version" >= 1),
	CONSTRAINT "switches_archived_consistency_check" CHECK (("switches"."archived" = true) = ("switches"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50) NOT NULL,
	"local_version" integer NOT NULL,
	"remote_version" integer NOT NULL,
	"resolution" varchar(50),
	"created_at" timestamptz NOT NULL,
	"resolved_at" timestamptz,
	"details" text,
	CONSTRAINT "sync_conflicts_resolution_check" CHECK ("sync_conflicts"."resolution" IS NULL OR "sync_conflicts"."resolution" IN ('local', 'remote', 'merged')),
	CONSTRAINT "sync_conflicts_resolution_resolved_at_check" CHECK (("sync_conflicts"."resolution" IS NULL) = ("sync_conflicts"."resolved_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "sync_documents" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50) NOT NULL,
	"automerge_heads" "bytea",
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamptz NOT NULL,
	"last_synced_at" timestamptz,
	CONSTRAINT "sync_documents_version_check" CHECK ("sync_documents"."version" >= 1),
	CONSTRAINT "sync_documents_automerge_heads_size_check" CHECK ("sync_documents"."automerge_heads" IS NULL OR octet_length("sync_documents"."automerge_heads") <= 16384)
);
--> statement-breakpoint
CREATE TABLE "sync_queue" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"encrypted_change_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"synced_at" timestamptz,
	CONSTRAINT "sync_queue_operation_check" CHECK ("sync_queue"."operation" IS NULL OR "sync_queue"."operation" IN ('create', 'update', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"locale" varchar(255),
	"pin_hash" varchar(512),
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "system_settings_system_id_unique" UNIQUE("system_id"),
	CONSTRAINT "system_settings_version_check" CHECK ("system_settings"."version" >= 1),
	CONSTRAINT "system_settings_pin_hash_kdf_check" CHECK ("system_settings"."pin_hash" IS NULL OR "system_settings"."pin_hash" LIKE '$argon2id$%')
);
--> statement-breakpoint
CREATE TABLE "system_snapshots" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"snapshot_trigger" varchar(50) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "system_snapshots_snapshot_trigger_check" CHECK ("system_snapshots"."snapshot_trigger" IS NULL OR "system_snapshots"."snapshot_trigger" IN ('manual', 'scheduled-daily', 'scheduled-weekly'))
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "systems_id_account_id_unique" UNIQUE("id","account_id"),
	CONSTRAINT "systems_version_check" CHECK ("systems"."version" >= 1),
	CONSTRAINT "systems_archived_consistency_check" CHECK (("systems"."archived" = true) = ("systems"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "timer_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"interval_minutes" integer,
	"waking_hours_only" boolean,
	"waking_start" varchar(255),
	"waking_end" varchar(255),
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "timer_configs_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "timer_configs_version_check" CHECK ("timer_configs"."version" >= 1),
	CONSTRAINT "timer_configs_waking_start_format" CHECK ("timer_configs"."waking_start" IS NULL OR "timer_configs"."waking_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "timer_configs_waking_end_format" CHECK ("timer_configs"."waking_end" IS NULL OR "timer_configs"."waking_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "timer_configs_archived_consistency_check" CHECK (("timer_configs"."archived" = true) = ("timer_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"secret" "bytea" NOT NULL,
	"event_types" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"crypto_key_id" varchar(50),
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "webhook_configs_id_system_id_unique" UNIQUE("id","system_id"),
	CONSTRAINT "webhook_configs_archived_consistency_check" CHECK (("webhook_configs"."archived" = true) = ("webhook_configs"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"webhook_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamptz,
	"next_retry_at" timestamptz,
	"encrypted_data" "bytea",
	"created_at" timestamptz NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "webhook_deliveries_event_type_check" CHECK ("webhook_deliveries"."event_type" IS NULL OR "webhook_deliveries"."event_type" IN ('member.created', 'member.updated', 'member.archived', 'fronting.started', 'fronting.ended', 'switch.recorded', 'group.created', 'group.updated', 'note.created', 'note.updated', 'chat.message-sent', 'poll.created', 'poll.closed', 'acknowledgement.requested', 'lifecycle.event-recorded', 'custom-front.changed')),
	CONSTRAINT "webhook_deliveries_status_check" CHECK ("webhook_deliveries"."status" IS NULL OR "webhook_deliveries"."status" IN ('pending', 'success', 'failed')),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK ("webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_http_status_check" CHECK ("webhook_deliveries"."http_status" IS NULL OR ("webhook_deliveries"."http_status" >= 100 AND "webhook_deliveries"."http_status" <= 599)),
	CONSTRAINT "webhook_deliveries_archived_consistency_check" CHECK (("webhook_deliveries"."archived" = true) = ("webhook_deliveries"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"slug_hash" varchar(64) NOT NULL,
	"encrypted_data" "bytea" NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamptz,
	CONSTRAINT "wiki_pages_version_check" CHECK ("wiki_pages"."version" >= 1),
	CONSTRAINT "wiki_pages_archived_consistency_check" CHECK (("wiki_pages"."archived" = true) = ("wiki_pages"."archived_at" IS NOT NULL)),
	CONSTRAINT "wiki_pages_slug_hash_length_check" CHECK (length("wiki_pages"."slug_hash") = 64)
);
--> statement-breakpoint
ALTER TABLE "account_purge_requests" ADD CONSTRAINT "account_purge_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_created_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("created_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_system_id_account_id_systems_id_account_id_fk" FOREIGN KEY ("system_id","account_id") REFERENCES "public"."systems"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_keys" ADD CONSTRAINT "auth_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_tokens" ADD CONSTRAINT "biometric_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blob_metadata" ADD CONSTRAINT "blob_metadata_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blob_metadata" ADD CONSTRAINT "blob_metadata_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blob_metadata" ADD CONSTRAINT "blob_metadata_thumbnail_of_blob_id_blob_metadata_id_fk" FOREIGN KEY ("thumbnail_of_blob_id") REFERENCES "public"."blob_metadata"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_messages" ADD CONSTRAINT "board_messages_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ADD CONSTRAINT "bucket_content_tags_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ADD CONSTRAINT "bucket_content_tags_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ADD CONSTRAINT "bucket_key_rotations_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ADD CONSTRAINT "bucket_key_rotations_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ADD CONSTRAINT "bucket_rotation_items_rotation_id_bucket_key_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."bucket_key_rotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ADD CONSTRAINT "bucket_rotation_items_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buckets" ADD CONSTRAINT "buckets_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_parent_id_system_id_channels_id_system_id_fk" FOREIGN KEY ("parent_id","system_id") REFERENCES "public"."channels"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_timer_config_id_system_id_timer_configs_id_system_id_fk" FOREIGN KEY ("timer_config_id","system_id") REFERENCES "public"."timer_configs"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_responded_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("responded_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_fronts" ADD CONSTRAINT "custom_fronts_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ADD CONSTRAINT "device_transfer_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ADD CONSTRAINT "device_transfer_requests_source_session_id_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ADD CONSTRAINT "device_transfer_requests_target_session_id_sessions_id_fk" FOREIGN KEY ("target_session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_blob_id_blob_metadata_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."blob_metadata"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_system_id_account_id_systems_id_account_id_fk" FOREIGN KEY ("system_id","account_id") REFERENCES "public"."systems"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ADD CONSTRAINT "field_bucket_visibility_field_definition_id_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ADD CONSTRAINT "field_bucket_visibility_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ADD CONSTRAINT "field_bucket_visibility_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_field_definition_id_system_id_field_definitions_id_system_id_fk" FOREIGN KEY ("field_definition_id","system_id") REFERENCES "public"."field_definitions"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ADD CONSTRAINT "friend_bucket_assignments_friend_connection_id_friend_connections_id_fk" FOREIGN KEY ("friend_connection_id") REFERENCES "public"."friend_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ADD CONSTRAINT "friend_bucket_assignments_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ADD CONSTRAINT "friend_bucket_assignments_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_friend_account_id_accounts_id_fk" FOREIGN KEY ("friend_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_notification_preferences" ADD CONSTRAINT "friend_notification_preferences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_notification_preferences" ADD CONSTRAINT "friend_notification_preferences_friend_connection_id_account_id_friend_connections_id_account_id_fk" FOREIGN KEY ("friend_connection_id","account_id") REFERENCES "public"."friend_connections"("id","account_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_comments" ADD CONSTRAINT "fronting_comments_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_comments" ADD CONSTRAINT "fronting_comments_fronting_session_id_system_id_session_start_time_fronting_sessions_id_system_id_start_time_fk" FOREIGN KEY ("fronting_session_id","system_id","session_start_time") REFERENCES "public"."fronting_sessions"("id","system_id","start_time") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_comments" ADD CONSTRAINT "fronting_comments_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD CONSTRAINT "fronting_reports_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_custom_front_id_custom_fronts_id_fk" FOREIGN KEY ("custom_front_id") REFERENCES "public"."custom_fronts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_system_id_groups_id_system_id_fk" FOREIGN KEY ("group_id","system_id") REFERENCES "public"."groups"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_system_id_groups_id_system_id_fk" FOREIGN KEY ("parent_group_id","system_id") REFERENCES "public"."groups"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_system_id_account_id_systems_id_account_id_fk" FOREIGN KEY ("system_id","account_id") REFERENCES "public"."systems"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_canvas" ADD CONSTRAINT "innerworld_canvas_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_entities" ADD CONSTRAINT "innerworld_entities_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_entities" ADD CONSTRAINT "innerworld_entities_region_id_innerworld_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."innerworld_regions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_regions" ADD CONSTRAINT "innerworld_regions_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_regions" ADD CONSTRAINT "innerworld_regions_parent_region_id_system_id_innerworld_regions_id_system_id_fk" FOREIGN KEY ("parent_region_id","system_id") REFERENCES "public"."innerworld_regions"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_grants" ADD CONSTRAINT "key_grants_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_grants" ADD CONSTRAINT "key_grants_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_grants" ADD CONSTRAINT "key_grants_friend_account_id_accounts_id_fk" FOREIGN KEY ("friend_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layer_memberships" ADD CONSTRAINT "layer_memberships_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layer_memberships" ADD CONSTRAINT "layer_memberships_layer_id_system_id_layers_id_system_id_fk" FOREIGN KEY ("layer_id","system_id") REFERENCES "public"."layers"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layer_memberships" ADD CONSTRAINT "layer_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_photos" ADD CONSTRAINT "member_photos_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_photos" ADD CONSTRAINT "member_photos_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_system_id_channels_id_system_id_fk" FOREIGN KEY ("channel_id","system_id") REFERENCES "public"."channels"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomenclature_settings" ADD CONSTRAINT "nomenclature_settings_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pk_bridge_configs" ADD CONSTRAINT "pk_bridge_configs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_system_id_polls_id_system_id_fk" FOREIGN KEY ("poll_id","system_id") REFERENCES "public"."polls"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("created_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_keys" ADD CONSTRAINT "recovery_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("source_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("target_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_mode_content" ADD CONSTRAINT "safe_mode_content_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ADD CONSTRAINT "side_system_layer_links_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ADD CONSTRAINT "side_system_layer_links_side_system_id_system_id_side_systems_id_system_id_fk" FOREIGN KEY ("side_system_id","system_id") REFERENCES "public"."side_systems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_layer_links" ADD CONSTRAINT "side_system_layer_links_layer_id_system_id_layers_id_system_id_fk" FOREIGN KEY ("layer_id","system_id") REFERENCES "public"."layers"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_memberships" ADD CONSTRAINT "side_system_memberships_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_memberships" ADD CONSTRAINT "side_system_memberships_side_system_id_system_id_side_systems_id_system_id_fk" FOREIGN KEY ("side_system_id","system_id") REFERENCES "public"."side_systems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_memberships" ADD CONSTRAINT "side_system_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_systems" ADD CONSTRAINT "side_systems_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ADD CONSTRAINT "subsystem_layer_links_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ADD CONSTRAINT "subsystem_layer_links_subsystem_id_system_id_subsystems_id_system_id_fk" FOREIGN KEY ("subsystem_id","system_id") REFERENCES "public"."subsystems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_layer_links" ADD CONSTRAINT "subsystem_layer_links_layer_id_system_id_layers_id_system_id_fk" FOREIGN KEY ("layer_id","system_id") REFERENCES "public"."layers"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ADD CONSTRAINT "subsystem_memberships_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ADD CONSTRAINT "subsystem_memberships_subsystem_id_system_id_subsystems_id_system_id_fk" FOREIGN KEY ("subsystem_id","system_id") REFERENCES "public"."subsystems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ADD CONSTRAINT "subsystem_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ADD CONSTRAINT "subsystem_side_system_links_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ADD CONSTRAINT "subsystem_side_system_links_subsystem_id_system_id_subsystems_id_system_id_fk" FOREIGN KEY ("subsystem_id","system_id") REFERENCES "public"."subsystems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_side_system_links" ADD CONSTRAINT "subsystem_side_system_links_side_system_id_system_id_side_systems_id_system_id_fk" FOREIGN KEY ("side_system_id","system_id") REFERENCES "public"."side_systems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystems" ADD CONSTRAINT "subsystems_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystems" ADD CONSTRAINT "subsystems_parent_subsystem_id_system_id_subsystems_id_system_id_fk" FOREIGN KEY ("parent_subsystem_id","system_id") REFERENCES "public"."subsystems"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "switches" ADD CONSTRAINT "switches_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_documents" ADD CONSTRAINT "sync_documents_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_snapshots" ADD CONSTRAINT "system_snapshots_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_configs" ADD CONSTRAINT "timer_configs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_crypto_key_id_api_keys_id_fk" FOREIGN KEY ("crypto_key_id") REFERENCES "public"."api_keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_system_id_webhook_configs_id_system_id_fk" FOREIGN KEY ("webhook_id","system_id") REFERENCES "public"."webhook_configs"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_purge_requests_account_id_idx" ON "account_purge_requests" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_purge_requests_active_unique_idx" ON "account_purge_requests" USING btree ("account_id") WHERE "account_purge_requests"."status" IN ('pending', 'confirmed', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_hash_idx" ON "accounts" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "acknowledgements_system_id_confirmed_idx" ON "acknowledgements" USING btree ("system_id","confirmed");--> statement-breakpoint
CREATE INDEX "acknowledgements_system_archived_idx" ON "acknowledgements" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "api_keys_account_id_idx" ON "api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "api_keys_system_id_idx" ON "api_keys" USING btree ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_token_hash_idx" ON "api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_keys_revoked_at_idx" ON "api_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "api_keys_key_type_idx" ON "api_keys" USING btree ("key_type");--> statement-breakpoint
CREATE INDEX "audit_log_account_timestamp_idx" ON "audit_log" USING btree ("account_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_system_timestamp_idx" ON "audit_log" USING btree ("system_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_system_event_type_timestamp_idx" ON "audit_log" USING btree ("system_id","event_type","timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "auth_keys_account_id_idx" ON "auth_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "biometric_tokens_session_id_idx" ON "biometric_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_tokens_token_hash_idx" ON "biometric_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "blob_metadata_system_id_purpose_idx" ON "blob_metadata" USING btree ("system_id","purpose");--> statement-breakpoint
CREATE INDEX "blob_metadata_system_archived_idx" ON "blob_metadata" USING btree ("system_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "blob_metadata_storage_key_idx" ON "blob_metadata" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "board_messages_system_archived_idx" ON "board_messages" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "bucket_content_tags_bucket_id_idx" ON "bucket_content_tags" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "bucket_content_tags_system_id_idx" ON "bucket_content_tags" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "bucket_key_rotations_bucket_state_idx" ON "bucket_key_rotations" USING btree ("bucket_id","state");--> statement-breakpoint
CREATE INDEX "bucket_key_rotations_system_id_idx" ON "bucket_key_rotations" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "bucket_rotation_items_rotation_status_idx" ON "bucket_rotation_items" USING btree ("rotation_id","status");--> statement-breakpoint
CREATE INDEX "bucket_rotation_items_status_claimed_by_idx" ON "bucket_rotation_items" USING btree ("status","claimed_by");--> statement-breakpoint
CREATE INDEX "bucket_rotation_items_system_id_idx" ON "bucket_rotation_items" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "buckets_system_archived_idx" ON "buckets" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "channels_system_archived_idx" ON "channels" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "check_in_records_system_id_idx" ON "check_in_records" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "check_in_records_timer_config_id_idx" ON "check_in_records" USING btree ("timer_config_id");--> statement-breakpoint
CREATE INDEX "check_in_records_scheduled_at_idx" ON "check_in_records" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "check_in_records_system_pending_idx" ON "check_in_records" USING btree ("system_id","scheduled_at") WHERE "check_in_records"."responded_at" IS NULL AND "check_in_records"."dismissed" = false AND "check_in_records"."archived" = false;--> statement-breakpoint
CREATE INDEX "custom_fronts_system_archived_idx" ON "custom_fronts" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "device_tokens_account_id_idx" ON "device_tokens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "device_tokens_system_id_idx" ON "device_tokens" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "device_tokens_revoked_at_idx" ON "device_tokens" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "device_transfer_requests_account_status_idx" ON "device_transfer_requests" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "device_transfer_requests_status_expires_idx" ON "device_transfer_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "export_requests_account_id_idx" ON "export_requests" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "export_requests_system_id_idx" ON "export_requests" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "field_bucket_visibility_bucket_id_idx" ON "field_bucket_visibility" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "field_bucket_visibility_system_id_idx" ON "field_bucket_visibility" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "field_definitions_system_archived_idx" ON "field_definitions" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "field_values_definition_system_idx" ON "field_values" USING btree ("field_definition_id","system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_definition_member_uniq" ON "field_values" USING btree ("field_definition_id","member_id") WHERE "field_values"."member_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_definition_system_uniq" ON "field_values" USING btree ("field_definition_id","system_id") WHERE "field_values"."member_id" IS NULL;--> statement-breakpoint
CREATE INDEX "friend_bucket_assignments_bucket_id_idx" ON "friend_bucket_assignments" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "friend_bucket_assignments_system_id_idx" ON "friend_bucket_assignments" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "friend_codes_account_archived_idx" ON "friend_codes" USING btree ("account_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_codes_code_uniq" ON "friend_codes" USING btree ("code") WHERE "friend_codes"."archived" = false;--> statement-breakpoint
CREATE INDEX "friend_connections_account_status_idx" ON "friend_connections" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "friend_connections_friend_status_idx" ON "friend_connections" USING btree ("friend_account_id","status");--> statement-breakpoint
CREATE INDEX "friend_connections_account_archived_idx" ON "friend_connections" USING btree ("account_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_connections_account_friend_uniq" ON "friend_connections" USING btree ("account_id","friend_account_id") WHERE "friend_connections"."archived" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_notification_prefs_account_id_friend_connection_id_idx" ON "friend_notification_preferences" USING btree ("account_id","friend_connection_id") WHERE "friend_notification_preferences"."archived" = false;--> statement-breakpoint
CREATE INDEX "fronting_comments_session_created_idx" ON "fronting_comments" USING btree ("fronting_session_id","created_at");--> statement-breakpoint
CREATE INDEX "fronting_comments_session_start_idx" ON "fronting_comments" USING btree ("session_start_time");--> statement-breakpoint
CREATE INDEX "fronting_comments_system_archived_idx" ON "fronting_comments" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "fronting_reports_system_id_idx" ON "fronting_reports" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_start_idx" ON "fronting_sessions" USING btree ("system_id","start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_member_start_idx" ON "fronting_sessions" USING btree ("system_id","member_id","start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_end_idx" ON "fronting_sessions" USING btree ("system_id","end_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_type_start_idx" ON "fronting_sessions" USING btree ("system_id","fronting_type","start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_active_idx" ON "fronting_sessions" USING btree ("system_id") WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_archived_idx" ON "fronting_sessions" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "group_memberships_member_id_idx" ON "group_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "group_memberships_system_id_idx" ON "group_memberships" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "groups_system_archived_idx" ON "groups" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "import_jobs_account_id_status_idx" ON "import_jobs" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "import_jobs_system_id_idx" ON "import_jobs" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "innerworld_entities_region_id_idx" ON "innerworld_entities" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "innerworld_entities_system_archived_idx" ON "innerworld_entities" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "innerworld_regions_system_archived_idx" ON "innerworld_regions" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "journal_entries_system_id_created_at_idx" ON "journal_entries" USING btree ("system_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_entries_system_archived_idx" ON "journal_entries" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "journal_entries_fronting_session_id_idx" ON "journal_entries" USING btree ("fronting_session_id");--> statement-breakpoint
CREATE INDEX "key_grants_system_id_idx" ON "key_grants" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "key_grants_friend_bucket_idx" ON "key_grants" USING btree ("friend_account_id","bucket_id");--> statement-breakpoint
CREATE INDEX "key_grants_friend_revoked_idx" ON "key_grants" USING btree ("friend_account_id","revoked_at");--> statement-breakpoint
CREATE INDEX "key_grants_revoked_at_idx" ON "key_grants" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "layer_memberships_layer_id_idx" ON "layer_memberships" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX "layer_memberships_member_id_idx" ON "layer_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "layer_memberships_system_id_idx" ON "layer_memberships" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "layers_system_archived_idx" ON "layers" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "lifecycle_events_system_occurred_idx" ON "lifecycle_events" USING btree ("system_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lifecycle_events_system_recorded_idx" ON "lifecycle_events" USING btree ("system_id","recorded_at");--> statement-breakpoint
CREATE INDEX "member_photos_system_archived_idx" ON "member_photos" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "member_photos_member_sort_idx" ON "member_photos" USING btree ("member_id","sort_order");--> statement-breakpoint
CREATE INDEX "members_system_id_archived_idx" ON "members" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_channel_id_timestamp_idx" ON "messages" USING btree ("channel_id","timestamp");--> statement-breakpoint
CREATE INDEX "messages_system_archived_idx" ON "messages" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "messages_reply_to_id_idx" ON "messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "notes_system_archived_idx" ON "notes" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "notes_member_id_idx" ON "notes" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_configs_system_id_event_type_idx" ON "notification_configs" USING btree ("system_id","event_type") WHERE "notification_configs"."archived" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "pk_bridge_configs_system_id_idx" ON "pk_bridge_configs" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_votes_system_archived_idx" ON "poll_votes" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "polls_system_archived_idx" ON "polls" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "recovery_keys_account_id_idx" ON "recovery_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recovery_keys_revoked_at_idx" ON "recovery_keys" USING btree ("revoked_at") WHERE "recovery_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "relationships_system_archived_idx" ON "relationships" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "safe_mode_content_system_sort_idx" ON "safe_mode_content" USING btree ("system_id","sort_order");--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_revoked_last_active_idx" ON "sessions" USING btree ("revoked","last_active");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at") WHERE "sessions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sessions_ttl_duration_ms_idx" ON "sessions" USING btree ((EXTRACT(EPOCH FROM ("expires_at" - "created_at")) * 1000));--> statement-breakpoint
CREATE INDEX "side_system_layer_links_side_system_id_idx" ON "side_system_layer_links" USING btree ("side_system_id");--> statement-breakpoint
CREATE INDEX "side_system_layer_links_layer_id_idx" ON "side_system_layer_links" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX "side_system_memberships_side_system_id_idx" ON "side_system_memberships" USING btree ("side_system_id");--> statement-breakpoint
CREATE INDEX "side_system_memberships_member_id_idx" ON "side_system_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "side_system_memberships_system_id_idx" ON "side_system_memberships" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "side_systems_system_archived_idx" ON "side_systems" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "subsystem_layer_links_subsystem_id_idx" ON "subsystem_layer_links" USING btree ("subsystem_id");--> statement-breakpoint
CREATE INDEX "subsystem_layer_links_layer_id_idx" ON "subsystem_layer_links" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX "subsystem_memberships_subsystem_id_idx" ON "subsystem_memberships" USING btree ("subsystem_id");--> statement-breakpoint
CREATE INDEX "subsystem_memberships_member_id_idx" ON "subsystem_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "subsystem_memberships_system_id_idx" ON "subsystem_memberships" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "subsystem_side_system_links_subsystem_id_idx" ON "subsystem_side_system_links" USING btree ("subsystem_id");--> statement-breakpoint
CREATE INDEX "subsystem_side_system_links_side_system_id_idx" ON "subsystem_side_system_links" USING btree ("side_system_id");--> statement-breakpoint
CREATE INDEX "subsystems_system_archived_idx" ON "subsystems" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "switches_system_timestamp_idx" ON "switches" USING btree ("system_id","timestamp");--> statement-breakpoint
CREATE INDEX "switches_system_archived_idx" ON "switches" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "sync_conflicts_system_id_entity_type_entity_id_idx" ON "sync_conflicts" USING btree ("system_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_documents_system_id_entity_type_entity_id_idx" ON "sync_documents" USING btree ("system_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sync_queue_system_id_synced_at_idx" ON "sync_queue" USING btree ("system_id","synced_at");--> statement-breakpoint
CREATE INDEX "sync_queue_system_id_entity_type_entity_id_idx" ON "sync_queue" USING btree ("system_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_queue_seq_idx" ON "sync_queue" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "sync_queue_unsynced_idx" ON "sync_queue" USING btree ("system_id","seq") WHERE "sync_queue"."synced_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sync_queue_cleanup_idx" ON "sync_queue" USING btree ("synced_at") WHERE "sync_queue"."synced_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "system_snapshots_system_created_idx" ON "system_snapshots" USING btree ("system_id","created_at");--> statement-breakpoint
CREATE INDEX "systems_account_id_idx" ON "systems" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "timer_configs_system_archived_idx" ON "timer_configs" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "webhook_configs_system_archived_idx" ON "webhook_configs" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_system_id_idx" ON "webhook_deliveries" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_next_retry_at_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_terminal_created_at_idx" ON "webhook_deliveries" USING btree ("created_at") WHERE "webhook_deliveries"."status" IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX "webhook_deliveries_system_retry_idx" ON "webhook_deliveries" USING btree ("system_id","status","next_retry_at") WHERE "webhook_deliveries"."status" NOT IN ('success', 'failed');--> statement-breakpoint
CREATE INDEX "wiki_pages_system_archived_idx" ON "wiki_pages" USING btree ("system_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_system_id_slug_hash_idx" ON "wiki_pages" USING btree ("system_id","slug_hash") WHERE "wiki_pages"."archived" = false;