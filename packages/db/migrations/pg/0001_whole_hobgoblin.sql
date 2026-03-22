ALTER TABLE "fronting_sessions" DROP CONSTRAINT "fronting_sessions_subject_check";--> statement-breakpoint
DROP INDEX "system_structure_entity_associations_source_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_associations_target_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_associations_system_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_links_entity_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_links_parent_entity_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_links_system_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_member_links_parent_entity_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_member_links_member_id_idx";--> statement-breakpoint
DROP INDEX "system_structure_entity_member_links_system_id_idx";--> statement-breakpoint
CREATE INDEX "system_structure_entity_associations_system_source_idx" ON "system_structure_entity_associations" USING btree ("system_id","source_entity_id");--> statement-breakpoint
CREATE INDEX "system_structure_entity_associations_system_target_idx" ON "system_structure_entity_associations" USING btree ("system_id","target_entity_id");--> statement-breakpoint
CREATE INDEX "system_structure_entity_links_system_entity_idx" ON "system_structure_entity_links" USING btree ("system_id","entity_id");--> statement-breakpoint
CREATE INDEX "system_structure_entity_links_system_parent_idx" ON "system_structure_entity_links" USING btree ("system_id","parent_entity_id");--> statement-breakpoint
CREATE INDEX "system_structure_entity_member_links_system_member_idx" ON "system_structure_entity_member_links" USING btree ("system_id","member_id");--> statement-breakpoint
CREATE INDEX "system_structure_entity_member_links_system_parent_idx" ON "system_structure_entity_member_links" USING btree ("system_id","parent_entity_id");--> statement-breakpoint
ALTER TABLE "system_structure_entity_links" ADD CONSTRAINT "system_structure_entity_links_entity_parent_uniq" UNIQUE NULLS NOT DISTINCT("entity_id","parent_entity_id");--> statement-breakpoint
ALTER TABLE "system_structure_entity_member_links" ADD CONSTRAINT "system_structure_entity_member_links_member_parent_uniq" UNIQUE NULLS NOT DISTINCT("member_id","parent_entity_id");--> statement-breakpoint
ALTER TABLE "fronting_sessions" ADD CONSTRAINT "fronting_sessions_subject_check" CHECK (("fronting_sessions"."member_id" IS NOT NULL OR "fronting_sessions"."custom_front_id" IS NOT NULL OR "fronting_sessions"."structure_entity_id" IS NOT NULL));