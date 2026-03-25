PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_documents` (
	`document_id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`snapshot_version` integer DEFAULT 0 NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`time_period` text,
	`key_type` text DEFAULT 'derived' NOT NULL,
	`bucket_id` text,
	`channel_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_documents_doc_type_check" CHECK("__new_sync_documents"."doc_type" IS NULL OR "__new_sync_documents"."doc_type" IN ('system-core', 'fronting', 'chat', 'note', 'journal', 'privacy-config', 'bucket')),
	CONSTRAINT "sync_documents_key_type_check" CHECK("__new_sync_documents"."key_type" IS NULL OR "__new_sync_documents"."key_type" IN ('derived', 'bucket')),
	CONSTRAINT "sync_documents_size_bytes_check" CHECK("__new_sync_documents"."size_bytes" >= 0),
	CONSTRAINT "sync_documents_snapshot_version_check" CHECK("__new_sync_documents"."snapshot_version" >= 0),
	CONSTRAINT "sync_documents_last_seq_check" CHECK("__new_sync_documents"."last_seq" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_sync_documents`("document_id", "system_id", "doc_type", "size_bytes", "snapshot_version", "last_seq", "archived", "time_period", "key_type", "bucket_id", "channel_id", "created_at", "updated_at") SELECT "document_id", "system_id", "doc_type", "size_bytes", "snapshot_version", "last_seq", "archived", "time_period", "key_type", "bucket_id", "channel_id", "created_at", "updated_at" FROM `sync_documents`;--> statement-breakpoint
DROP TABLE `sync_documents`;--> statement-breakpoint
ALTER TABLE `__new_sync_documents` RENAME TO `sync_documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sync_documents_system_id_idx` ON `sync_documents` (`system_id`);--> statement-breakpoint
CREATE INDEX `sync_documents_system_id_doc_type_idx` ON `sync_documents` (`system_id`,`doc_type`);