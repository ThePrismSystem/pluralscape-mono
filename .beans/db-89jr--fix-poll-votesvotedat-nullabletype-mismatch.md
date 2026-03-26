---
# db-89jr
title: Fix poll_votes.votedAt nullable/type mismatch
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:18:10Z
parent: ps-106o
---

DB column is nullable but the types interface declares votedAt as UnixMillis (non-nullable).

## Files

- packages/db/src/schema/pg/communication.ts:202
- packages/types/src/communication.ts:141

## Fix

Make the column .notNull() or add a comment explaining the design choice. Regenerate migrations if schema changes.

## Tasks

- [ ] Resolve nullability mismatch
- [ ] Regenerate migrations if needed

## Summary of Changes\n\nMade poll_votes.votedAt column NOT NULL in both PG and SQLite schemas. Updated PollVoteResult interface to use UnixMillis (non-nullable). Regenerated drizzle migration and updated all test inserts.
