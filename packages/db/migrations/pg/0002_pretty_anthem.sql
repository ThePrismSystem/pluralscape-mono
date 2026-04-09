CREATE TABLE "import_entity_refs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"system_id" varchar(50) NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_entity_type" varchar(50) NOT NULL,
	"source_entity_id" varchar(128) NOT NULL,
	"pluralscape_entity_id" varchar(50) NOT NULL,
	"imported_at" timestamptz NOT NULL,
	CONSTRAINT "import_entity_refs_source_check" CHECK ("import_entity_refs"."source" IS NULL OR "import_entity_refs"."source" IN ('simply-plural', 'pluralkit', 'pluralscape')),
	CONSTRAINT "import_entity_refs_source_entity_type_check" CHECK ("import_entity_refs"."source_entity_type" IS NULL OR "import_entity_refs"."source_entity_type" IN ('member', 'group', 'fronting-session', 'switch', 'custom-field', 'note', 'chat-message', 'board-message', 'poll', 'timer', 'privacy-bucket', 'friend', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "checkpoint_state" jsonb;--> statement-breakpoint
ALTER TABLE "import_entity_refs" ADD CONSTRAINT "import_entity_refs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_entity_refs" ADD CONSTRAINT "import_entity_refs_system_id_account_id_systems_id_account_id_fk" FOREIGN KEY ("system_id","account_id") REFERENCES "public"."systems"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_entity_refs_source_unique_idx" ON "import_entity_refs" USING btree ("account_id","system_id","source","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "import_entity_refs_pluralscape_entity_id_idx" ON "import_entity_refs" USING btree ("pluralscape_entity_id");--> statement-breakpoint
CREATE INDEX "import_entity_refs_account_system_idx" ON "import_entity_refs" USING btree ("account_id","system_id");