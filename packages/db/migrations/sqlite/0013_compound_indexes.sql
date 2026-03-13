DROP INDEX IF EXISTS "audit_log_event_type_idx";--> statement-breakpoint
CREATE INDEX "audit_log_system_event_type_timestamp_idx" ON "audit_log" ("system_id", "event_type", "timestamp");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_type_start_idx" ON "fronting_sessions" ("system_id", "fronting_type", "start_time");--> statement-breakpoint
DROP INDEX IF EXISTS "sync_queue_unsynced_idx";--> statement-breakpoint
CREATE INDEX "sync_queue_unsynced_idx" ON "sync_queue" ("system_id", "seq") WHERE "synced_at" IS NULL;
