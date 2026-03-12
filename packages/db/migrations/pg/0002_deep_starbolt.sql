-- Part 1: kdfSalt NOT NULL
ALTER TABLE "accounts" ALTER COLUMN "kdf_salt" SET NOT NULL;--> statement-breakpoint

-- Part 2: sync_queue seq column
ALTER TABLE "sync_queue" ADD COLUMN "seq" serial NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_queue_seq_idx" ON "sync_queue" USING btree ("seq");--> statement-breakpoint

-- Part 3: messages table partitioning
-- Pre-release: no production data, so we DROP and recreate with PARTITION BY RANGE.
-- Drizzle cannot express partitioning; this is the only hand-edited section.

-- Drop dependent objects first
DROP INDEX IF EXISTS "messages_channel_id_timestamp_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "messages_system_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "messages_reply_to_id_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "messages";--> statement-breakpoint

-- Recreate with composite PK and range partitioning
CREATE TABLE "messages" (
    "id" varchar(255) NOT NULL,
    "channel_id" varchar(255) NOT NULL,
    "system_id" varchar(255) NOT NULL REFERENCES "systems"("id") ON DELETE CASCADE,
    "reply_to_id" varchar(255),
    "timestamp" timestamptz NOT NULL,
    "edited_at" timestamptz,
    "encrypted_data" bytea NOT NULL,
    "created_at" timestamptz NOT NULL,
    "updated_at" timestamptz NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "archived" boolean NOT NULL DEFAULT false,
    "archived_at" timestamptz,
    PRIMARY KEY ("id", "timestamp"),
    UNIQUE ("id", "system_id", "timestamp"),
    FOREIGN KEY ("channel_id", "system_id") REFERENCES "channels"("id", "system_id") ON DELETE CASCADE,
    CHECK ("version" >= 1),
    CHECK (("archived" = true) = ("archived_at" IS NOT NULL))
) PARTITION BY RANGE ("timestamp");--> statement-breakpoint

-- Indexes on partitioned table
CREATE INDEX "messages_channel_id_timestamp_idx" ON "messages" ("channel_id", "timestamp");--> statement-breakpoint
CREATE INDEX "messages_system_id_idx" ON "messages" ("system_id");--> statement-breakpoint
CREATE INDEX "messages_reply_to_id_idx" ON "messages" ("reply_to_id");--> statement-breakpoint

-- Initial monthly partitions (2026-01 through 2026-06) + default
-- New partitions should be created by a scheduled job before each month begins.
CREATE TABLE "messages_2026_01" PARTITION OF "messages" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');--> statement-breakpoint
CREATE TABLE "messages_2026_02" PARTITION OF "messages" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');--> statement-breakpoint
CREATE TABLE "messages_2026_03" PARTITION OF "messages" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE "messages_2026_04" PARTITION OF "messages" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE "messages_2026_05" PARTITION OF "messages" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE "messages_2026_06" PARTITION OF "messages" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE "messages_default" PARTITION OF "messages" DEFAULT;
