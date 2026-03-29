ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_archived_consistency_check";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" DROP COLUMN "archived";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_payload_presence_check" CHECK ("webhook_deliveries"."encrypted_data" IS NOT NULL OR "webhook_deliveries"."payload_data" IS NOT NULL);
