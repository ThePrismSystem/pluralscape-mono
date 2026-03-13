-- Pre-release: no production data. DROP + recreate fronting_sessions with
-- PARTITION BY RANGE (start_time). Drizzle cannot express table partitioning;
-- this section is hand-edited. See migration 0002 (messages) for the pattern.

-- Drop application-enforced journal_entries FK (removed from schema; remove from DB)
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_fronting_session_id_fronting_sessions_id_fk";--> statement-breakpoint

-- Drop fronting_comments (has FK referencing fronting_sessions)
DROP INDEX IF EXISTS "fronting_comments_session_created_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "fronting_comments";--> statement-breakpoint

-- Drop fronting_sessions indexes then the table
DROP INDEX IF EXISTS "fronting_sessions_system_start_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fronting_sessions_system_member_start_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fronting_sessions_system_end_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fronting_sessions_system_type_start_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fronting_sessions_active_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "fronting_sessions";--> statement-breakpoint

-- Recreate fronting_sessions with composite PK (id, start_time) and range partitioning
CREATE TABLE "fronting_sessions" (
    "id" varchar(50) NOT NULL,
    "system_id" varchar(50) NOT NULL REFERENCES "systems"("id") ON DELETE CASCADE,
    "start_time" timestamptz NOT NULL,
    "end_time" timestamptz,
    "member_id" varchar(50),
    "fronting_type" varchar(50) NOT NULL DEFAULT 'fronting',
    "custom_front_id" varchar(50),
    "linked_structure" jsonb,
    "encrypted_data" bytea NOT NULL,
    "created_at" timestamptz NOT NULL,
    "updated_at" timestamptz NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    PRIMARY KEY ("id", "start_time"),
    CONSTRAINT "fronting_sessions_id_system_id_unique" UNIQUE ("id", "system_id", "start_time"),
    FOREIGN KEY ("member_id", "system_id") REFERENCES "members"("id", "system_id") ON DELETE SET NULL,
    FOREIGN KEY ("custom_front_id") REFERENCES "custom_fronts"("id") ON DELETE SET NULL,
    CONSTRAINT "fronting_sessions_end_time_check" CHECK ("end_time" IS NULL OR "end_time" > "start_time"),
    CONSTRAINT "fronting_sessions_fronting_type_check" CHECK ("fronting_type" IN ('fronting', 'co-conscious')),
    CONSTRAINT "fronting_sessions_version_check" CHECK ("version" >= 1),
    CONSTRAINT "fronting_sessions_subject_check" CHECK ("member_id" IS NOT NULL OR "custom_front_id" IS NOT NULL)
) PARTITION BY RANGE ("start_time");--> statement-breakpoint

-- Indexes on partitioned table
CREATE INDEX "fronting_sessions_system_start_idx" ON "fronting_sessions" ("system_id", "start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_member_start_idx" ON "fronting_sessions" ("system_id", "member_id", "start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_end_idx" ON "fronting_sessions" ("system_id", "end_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_system_type_start_idx" ON "fronting_sessions" ("system_id", "fronting_type", "start_time");--> statement-breakpoint
CREATE INDEX "fronting_sessions_active_idx" ON "fronting_sessions" ("system_id") WHERE "end_time" IS NULL;--> statement-breakpoint

-- Initial monthly partitions (2026-01 through 2026-06) + default
-- New partitions should be created by a scheduled job before each month begins.
CREATE TABLE "fronting_sessions_2026_01" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_2026_02" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_2026_03" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_2026_04" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_2026_05" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_2026_06" PARTITION OF "fronting_sessions" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE "fronting_sessions_default" PARTITION OF "fronting_sessions" DEFAULT;--> statement-breakpoint

-- Recreate fronting_comments with session_start_time for partition-aware FK.
-- session_start_time is denormalised from the parent session (see ADR 019).
CREATE TABLE "fronting_comments" (
    "id" varchar(50) PRIMARY KEY NOT NULL,
    "fronting_session_id" varchar(50) NOT NULL,
    "system_id" varchar(50) NOT NULL REFERENCES "systems"("id") ON DELETE CASCADE,
    "session_start_time" timestamptz NOT NULL,
    "member_id" varchar(50),
    "encrypted_data" bytea NOT NULL,
    "created_at" timestamptz NOT NULL,
    "updated_at" timestamptz NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    FOREIGN KEY ("fronting_session_id", "system_id", "session_start_time")
        REFERENCES "fronting_sessions"("id", "system_id", "start_time") ON DELETE CASCADE,
    FOREIGN KEY ("member_id", "system_id") REFERENCES "members"("id", "system_id") ON DELETE SET NULL,
    CONSTRAINT "fronting_comments_version_check" CHECK ("version" >= 1)
);--> statement-breakpoint

-- Indexes on fronting_comments
CREATE INDEX "fronting_comments_session_created_idx" ON "fronting_comments" ("fronting_session_id", "created_at");--> statement-breakpoint
CREATE INDEX "fronting_comments_session_start_idx" ON "fronting_comments" ("session_start_time");--> statement-breakpoint

-- Re-apply RLS on fronting_sessions (dropped with the table; partitioned tables inherit policy on all partitions)
ALTER TABLE "fronting_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fronting_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "fronting_sessions_system_isolation" ON "fronting_sessions";--> statement-breakpoint
CREATE POLICY "fronting_sessions_system_isolation" ON "fronting_sessions"
    USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)
    WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);--> statement-breakpoint

-- Re-apply RLS on fronting_comments (dropped with the table)
ALTER TABLE "fronting_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fronting_comments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "fronting_comments_system_isolation" ON "fronting_comments";--> statement-breakpoint
CREATE POLICY "fronting_comments_system_isolation" ON "fronting_comments"
    USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)
    WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);
