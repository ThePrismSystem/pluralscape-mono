ALTER TABLE "friend_codes" DROP CONSTRAINT "friend_codes_code_unique";--> statement-breakpoint
DROP INDEX "friend_codes_account_id_idx";--> statement-breakpoint
DROP INDEX "timer_configs_system_id_archived_idx";--> statement-breakpoint
DROP INDEX "webhook_configs_system_id_archived_idx";--> statement-breakpoint
CREATE INDEX "friend_codes_account_archived_idx" ON "friend_codes" USING btree ("account_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_codes_code_uniq" ON "friend_codes" USING btree ("code") WHERE "friend_codes"."archived" = false;--> statement-breakpoint
CREATE INDEX "timer_configs_system_archived_idx" ON "timer_configs" USING btree ("system_id","archived");--> statement-breakpoint
CREATE INDEX "webhook_configs_system_archived_idx" ON "webhook_configs" USING btree ("system_id","archived");