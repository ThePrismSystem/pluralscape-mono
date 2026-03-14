DROP INDEX "friend_notification_prefs_account_id_friend_connection_id_idx";--> statement-breakpoint
DROP INDEX "wiki_pages_system_id_slug_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "friend_notification_prefs_account_id_friend_connection_id_idx" ON "friend_notification_preferences" USING btree ("account_id","friend_connection_id") WHERE "friend_notification_preferences"."archived" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_system_id_slug_hash_idx" ON "wiki_pages" USING btree ("system_id","slug_hash") WHERE "wiki_pages"."archived" = false;