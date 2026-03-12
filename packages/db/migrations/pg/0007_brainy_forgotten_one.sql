ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_id_unique";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_id_unique";--> statement-breakpoint
ALTER TABLE "field_values" DROP CONSTRAINT "field_values_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "fronting_comments" DROP CONSTRAINT "fronting_comments_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "fronting_sessions" DROP CONSTRAINT "fronting_sessions_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "relationships" DROP CONSTRAINT "relationships_source_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "relationships" DROP CONSTRAINT "relationships_target_member_id_members_id_fk";
--> statement-breakpoint
DROP INDEX "friend_connections_friend_system_id_idx";--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_comments" ADD CONSTRAINT "fronting_comments_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("source_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("target_member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_id_unique" UNIQUE("id","timestamp");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_id_unique" UNIQUE("id","timestamp");