PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"system_id" text NOT NULL UNIQUE REFERENCES "systems"("id") ON DELETE CASCADE,
	"locale" text,
	"pin_hash" text,
	"biometric_enabled" integer DEFAULT false NOT NULL,
	"encrypted_data" blob NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CHECK("version" >= 1),
	CHECK("pin_hash" IS NULL OR "pin_hash" LIKE '$argon2id$%')
);--> statement-breakpoint
INSERT INTO "__new_system_settings" SELECT * FROM "system_settings";--> statement-breakpoint
DROP TABLE "system_settings";--> statement-breakpoint
ALTER TABLE "__new_system_settings" RENAME TO "system_settings";--> statement-breakpoint
PRAGMA foreign_keys=ON;
