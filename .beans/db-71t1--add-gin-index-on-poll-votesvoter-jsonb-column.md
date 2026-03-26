---
# db-71t1
title: Add GIN index on poll_votes.voter JSONB column
status: completed
type: bug
priority: high
created_at: 2026-03-26T07:42:26Z
updated_at: 2026-03-26T07:57:08Z
parent: ps-106o
---

castVote counts existing votes per voter using JSONB field extraction (voter->>'entityType', voter->>'entityId') with no supporting index. Every vote cast sequentially scans all existing votes for that poll while holding a FOR UPDATE lock.

## File

- poll-vote.service.ts:134-143

## Fix

Add a GIN index on poll_votes.voter, or extract voterEntityType/voterEntityId into indexed columns. Regenerate migrations afterward.

## Tasks

- [x] Add GIN index on poll_votes.voter (or extract to indexed columns)
- [x] Regenerate migrations
- [x] Regenerate RLS migration

## Summary of Changes

Added GIN index poll_votes_voter_gin_idx on poll_votes.voter JSONB column to support efficient voter extraction queries in castVote.
