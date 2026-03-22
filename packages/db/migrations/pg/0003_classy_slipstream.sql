ALTER TABLE "lifecycle_events" ADD COLUMN "updated_at" timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD COLUMN "archived_at" timestamptz;--> statement-breakpoint
CREATE INDEX "lifecycle_events_system_archived_idx" ON "lifecycle_events" USING btree ("system_id","archived");--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_version_check" CHECK ("lifecycle_events"."version" >= 1);--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_archived_consistency_check" CHECK (("lifecycle_events"."archived" = true) = ("lifecycle_events"."archived_at" IS NOT NULL));