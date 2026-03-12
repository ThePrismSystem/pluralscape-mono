DROP INDEX "recovery_keys_revoked_at_idx";--> statement-breakpoint
DROP INDEX "sessions_expires_at_idx";--> statement-breakpoint
CREATE INDEX "recovery_keys_revoked_at_idx" ON "recovery_keys" USING btree ("revoked_at") WHERE "recovery_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at") WHERE "sessions"."expires_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "device_transfer_requests" ADD CONSTRAINT "device_transfer_requests_key_material_check" CHECK ("device_transfer_requests"."status" != 'approved' OR "device_transfer_requests"."encrypted_key_material" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expires_at_check" CHECK ("sessions"."expires_at" IS NULL OR "sessions"."expires_at" > "sessions"."created_at");