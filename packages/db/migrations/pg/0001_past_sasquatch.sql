ALTER TABLE "fronting_reports" ADD COLUMN "created_at" timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD COLUMN "updated_at" timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD COLUMN "archived_at" timestamptz;--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD CONSTRAINT "fronting_reports_version_check" CHECK ("fronting_reports"."version" >= 1);--> statement-breakpoint
ALTER TABLE "fronting_reports" ADD CONSTRAINT "fronting_reports_archived_consistency_check" CHECK (("fronting_reports"."archived" = true) = ("fronting_reports"."archived_at" IS NOT NULL));