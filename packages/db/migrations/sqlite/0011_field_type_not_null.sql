PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"system_id" text NOT NULL REFERENCES "systems"("id") ON DELETE CASCADE,
	"field_type" text NOT NULL,
	"required" integer DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"encrypted_data" blob NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" integer DEFAULT false NOT NULL,
	"archived_at" integer,
	UNIQUE("id", "system_id"),
	CHECK("field_type" IS NULL OR "field_type" IN ('text', 'number', 'boolean', 'date', 'color', 'select', 'multi-select', 'url')),
	CHECK("version" >= 1),
	CHECK(("archived" = true) = ("archived_at" IS NOT NULL))
);--> statement-breakpoint
INSERT INTO "__new_field_definitions" SELECT * FROM "field_definitions";--> statement-breakpoint
DROP TABLE "field_definitions";--> statement-breakpoint
ALTER TABLE "__new_field_definitions" RENAME TO "field_definitions";--> statement-breakpoint
CREATE INDEX "field_definitions_system_id_idx" ON "field_definitions" ("system_id");--> statement-breakpoint
PRAGMA foreign_keys=ON;
