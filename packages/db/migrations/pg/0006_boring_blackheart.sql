ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_name_or_encrypted_data_check";--> statement-breakpoint
ALTER TABLE "acknowledgements" DROP CONSTRAINT "acknowledgements_created_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "channels" DROP CONSTRAINT "channels_parent_id_channels_id_fk";
--> statement-breakpoint
ALTER TABLE "check_in_records" DROP CONSTRAINT "check_in_records_responded_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "groups_parent_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "innerworld_regions" DROP CONSTRAINT "innerworld_regions_parent_region_id_innerworld_regions_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "polls" DROP CONSTRAINT "polls_created_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "subsystems" DROP CONSTRAINT "subsystems_parent_subsystem_id_subsystems_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "encrypted_data" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_created_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("created_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_parent_id_system_id_channels_id_system_id_fk" FOREIGN KEY ("parent_id","system_id") REFERENCES "public"."channels"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_responded_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("responded_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_system_id_groups_id_system_id_fk" FOREIGN KEY ("parent_group_id","system_id") REFERENCES "public"."groups"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innerworld_regions" ADD CONSTRAINT "innerworld_regions_parent_region_id_system_id_innerworld_regions_id_system_id_fk" FOREIGN KEY ("parent_region_id","system_id") REFERENCES "public"."innerworld_regions"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("created_by_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystems" ADD CONSTRAINT "subsystems_parent_subsystem_id_system_id_subsystems_id_system_id_fk" FOREIGN KEY ("parent_subsystem_id","system_id") REFERENCES "public"."subsystems"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_connections_friend_status_idx" ON "friend_connections" USING btree ("friend_system_id","status");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_member_start_idx" ON "fronting_sessions" USING btree ("system_id","member_id","start_time");--> statement-breakpoint
CREATE INDEX "key_grants_friend_revoked_idx" ON "key_grants" USING btree ("friend_system_id","revoked_at");--> statement-breakpoint
CREATE INDEX "wiki_pages_system_archived_idx" ON "wiki_pages" USING btree ("system_id","archived");--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_token_platform_unique" UNIQUE("token","platform");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_code_min_length_check" CHECK (length("friend_codes"."code") >= 8);