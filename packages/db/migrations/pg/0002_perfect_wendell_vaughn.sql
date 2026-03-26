ALTER TABLE "acknowledgements" ADD COLUMN "updated_at" timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_version_check" CHECK ("acknowledgements"."version" >= 1);