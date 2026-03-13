-- Denormalize system_id onto 6 join-based tables for direct RLS evaluation.
-- Avoids JOIN subqueries in RLS policies (O(1) vs O(log n) per row access).
-- Pre-release: no production data; backfill is safe.

-- bucket_content_tags
ALTER TABLE "bucket_content_tags" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "bucket_content_tags" SET "system_id" = (SELECT "system_id" FROM "buckets" WHERE "buckets"."id" = "bucket_content_tags"."bucket_id");--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bucket_content_tags" ADD CONSTRAINT "bucket_content_tags_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "bucket_content_tags_system_id_idx" ON "bucket_content_tags" ("system_id");--> statement-breakpoint

-- key_grants
ALTER TABLE "key_grants" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "key_grants" SET "system_id" = (SELECT "system_id" FROM "buckets" WHERE "buckets"."id" = "key_grants"."bucket_id");--> statement-breakpoint
ALTER TABLE "key_grants" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "key_grants" ADD CONSTRAINT "key_grants_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "key_grants_system_id_idx" ON "key_grants" ("system_id");--> statement-breakpoint

-- friend_bucket_assignments
ALTER TABLE "friend_bucket_assignments" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "friend_bucket_assignments" SET "system_id" = (SELECT "system_id" FROM "buckets" WHERE "buckets"."id" = "friend_bucket_assignments"."bucket_id");--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_bucket_assignments" ADD CONSTRAINT "friend_bucket_assignments_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "friend_bucket_assignments_system_id_idx" ON "friend_bucket_assignments" ("system_id");--> statement-breakpoint

-- field_bucket_visibility
ALTER TABLE "field_bucket_visibility" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "field_bucket_visibility" SET "system_id" = (SELECT "system_id" FROM "buckets" WHERE "buckets"."id" = "field_bucket_visibility"."bucket_id");--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "field_bucket_visibility" ADD CONSTRAINT "field_bucket_visibility_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "field_bucket_visibility_system_id_idx" ON "field_bucket_visibility" ("system_id");--> statement-breakpoint

-- bucket_key_rotations
ALTER TABLE "bucket_key_rotations" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "bucket_key_rotations" SET "system_id" = (SELECT "system_id" FROM "buckets" WHERE "buckets"."id" = "bucket_key_rotations"."bucket_id");--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bucket_key_rotations" ADD CONSTRAINT "bucket_key_rotations_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "bucket_key_rotations_system_id_idx" ON "bucket_key_rotations" ("system_id");--> statement-breakpoint

-- bucket_rotation_items (two-hop: rotation_id → bucket_key_rotations.system_id)
ALTER TABLE "bucket_rotation_items" ADD COLUMN "system_id" varchar(50);--> statement-breakpoint
UPDATE "bucket_rotation_items" SET "system_id" = (
  SELECT "bkr"."system_id"
  FROM "bucket_key_rotations" "bkr"
  WHERE "bkr"."id" = "bucket_rotation_items"."rotation_id"
);--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bucket_rotation_items" ADD CONSTRAINT "bucket_rotation_items_system_id_systems_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "bucket_rotation_items_system_id_idx" ON "bucket_rotation_items" ("system_id");
