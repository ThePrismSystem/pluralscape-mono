-- Pre-release: no production data. DROP + recreate switches with
-- PARTITION BY RANGE (timestamp), upgrading the PK from (id) to (id, timestamp).
-- Drizzle cannot express table partitioning; this section is hand-edited.

-- Drop switches index then the table
DROP INDEX IF EXISTS "switches_system_timestamp_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "switches";--> statement-breakpoint

-- Recreate switches with composite PK (id, timestamp) and range partitioning
CREATE TABLE "switches" (
    "id" varchar(50) NOT NULL,
    "system_id" varchar(50) NOT NULL REFERENCES "systems"("id") ON DELETE CASCADE,
    "timestamp" timestamptz NOT NULL,
    "member_ids" jsonb NOT NULL,
    "created_at" timestamptz NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    PRIMARY KEY ("id", "timestamp"),
    CONSTRAINT "switches_member_ids_check" CHECK (jsonb_array_length("member_ids") >= 1),
    CONSTRAINT "switches_version_check" CHECK ("version" >= 1)
) PARTITION BY RANGE ("timestamp");--> statement-breakpoint

-- Index on partitioned table
CREATE INDEX "switches_system_timestamp_idx" ON "switches" ("system_id", "timestamp");--> statement-breakpoint

-- Initial monthly partitions (2026-01 through 2026-06) + default
-- New partitions should be created by a scheduled job before each month begins.
CREATE TABLE "switches_2026_01" PARTITION OF "switches" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');--> statement-breakpoint
CREATE TABLE "switches_2026_02" PARTITION OF "switches" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');--> statement-breakpoint
CREATE TABLE "switches_2026_03" PARTITION OF "switches" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE "switches_2026_04" PARTITION OF "switches" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE "switches_2026_05" PARTITION OF "switches" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE "switches_2026_06" PARTITION OF "switches" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE "switches_default" PARTITION OF "switches" DEFAULT;--> statement-breakpoint

-- Re-apply RLS (dropped with the table; partitioned tables inherit policy on all partitions)
ALTER TABLE "switches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "switches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "switches_system_isolation" ON "switches";--> statement-breakpoint
CREATE POLICY "switches_system_isolation" ON "switches"
    USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)
    WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);
