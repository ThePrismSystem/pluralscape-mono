DROP INDEX "account_purge_requests_pending_unique_idx";--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "required" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "required" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "field_definitions" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "fronting_type" SET DEFAULT 'fronting';--> statement-breakpoint
ALTER TABLE "fronting_sessions" ALTER COLUMN "fronting_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ALTER COLUMN "event_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "is_veto" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "is_veto" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "bidirectional" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "bidirectional" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "safe_mode_content" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "safe_mode_content" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "has_core" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "subsystems" ALTER COLUMN "has_core" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_purge_requests_active_unique_idx" ON "account_purge_requests" USING btree ("account_id") WHERE status IN ('pending', 'confirmed', 'processing');--> statement-breakpoint
ALTER TABLE "blob_metadata" ADD CONSTRAINT "blob_metadata_size_bytes_max_check" CHECK ("blob_metadata"."size_bytes" <= 10737418240);--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_subject_check" CHECK ("fronting_sessions"."member_id" IS NOT NULL OR "fronting_sessions"."custom_front_id" IS NOT NULL);