CREATE TABLE "biometric_tokens" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"session_id" varchar(50) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"created_at" timestamptz NOT NULL
);
--> statement-breakpoint
ALTER TABLE "biometric_tokens" ADD CONSTRAINT "biometric_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "biometric_tokens_session_id_idx" ON "biometric_tokens" USING btree ("session_id");