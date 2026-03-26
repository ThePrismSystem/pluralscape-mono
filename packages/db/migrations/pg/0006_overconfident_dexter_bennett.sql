-- Safe: pre-production, no live data. All code paths set voted_at to now() on insert.
ALTER TABLE "poll_votes" ALTER COLUMN "voted_at" SET NOT NULL;