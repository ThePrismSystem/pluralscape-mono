ALTER TABLE "sessions" ADD COLUMN "token_hash" varchar(128) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");