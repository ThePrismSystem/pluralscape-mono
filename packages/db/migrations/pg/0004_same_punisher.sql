ALTER TABLE "wiki_pages" RENAME COLUMN "slug" TO "slug_hash";--> statement-breakpoint
DROP INDEX "wiki_pages_system_id_slug_idx";--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "encrypted_data" "bytea";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "encrypted_data" "bytea";--> statement-breakpoint
CREATE INDEX "webhook_deliveries_terminal_created_at_idx" ON "webhook_deliveries" USING btree ("created_at") WHERE "webhook_deliveries"."status" IN ('success', 'failed');--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_system_id_slug_hash_idx" ON "wiki_pages" USING btree ("system_id","slug_hash");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_name_or_encrypted_data_check" CHECK ("api_keys"."name" IS NOT NULL OR "api_keys"."encrypted_data" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_slug_hash_length_check" CHECK (length("wiki_pages"."slug_hash") = 64);