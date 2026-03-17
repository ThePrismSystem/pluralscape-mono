ALTER TABLE "systems" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "archived_at" timestamptz;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_archived_consistency_check" CHECK (("systems"."archived" = true) = ("systems"."archived_at" IS NOT NULL));