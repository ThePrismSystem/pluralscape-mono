ALTER TABLE "layer_memberships" ADD COLUMN "member_id" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "side_system_memberships" ADD COLUMN "member_id" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ADD COLUMN "member_id" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "layer_memberships" ADD CONSTRAINT "layer_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_system_memberships" ADD CONSTRAINT "side_system_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsystem_memberships" ADD CONSTRAINT "subsystem_memberships_member_id_system_id_members_id_system_id_fk" FOREIGN KEY ("member_id","system_id") REFERENCES "public"."members"("id","system_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "layer_memberships_member_id_idx" ON "layer_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "side_system_memberships_member_id_idx" ON "side_system_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "subsystem_memberships_member_id_idx" ON "subsystem_memberships" USING btree ("member_id");