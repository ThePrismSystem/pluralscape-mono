DROP INDEX "acknowledgements_system_id_idx";--> statement-breakpoint
DROP INDEX "acknowledgements_confirmed_idx";--> statement-breakpoint
DROP INDEX "blob_metadata_system_id_idx";--> statement-breakpoint
DROP INDEX "bucket_content_tags_entity_idx";--> statement-breakpoint
DROP INDEX "members_system_id_idx";--> statement-breakpoint
DROP INDEX "members_archived_idx";--> statement-breakpoint
DROP INDEX "sessions_revoked_idx";--> statement-breakpoint
CREATE INDEX "acknowledgements_system_id_confirmed_idx" ON "acknowledgements" USING btree ("system_id","confirmed");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "blob_metadata_system_id_purpose_idx" ON "blob_metadata" USING btree ("system_id","purpose");--> statement-breakpoint
CREATE INDEX "friend_bucket_assignments_bucket_id_idx" ON "friend_bucket_assignments" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "fronting_sessions_active_idx" ON "fronting_sessions" USING btree ("system_id") WHERE "fronting_sessions"."end_time" IS NULL;--> statement-breakpoint
CREATE INDEX "members_system_id_archived_idx" ON "members" USING btree ("system_id","archived");