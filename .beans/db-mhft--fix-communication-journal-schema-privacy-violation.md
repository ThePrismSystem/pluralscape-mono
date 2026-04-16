---
# db-mhft
title: Fix communication + journal schema privacy violations
status: completed
type: task
priority: normal
created_at: 2026-03-10T05:38:45Z
updated_at: 2026-04-16T07:29:38Z
parent: db-2nr7
---

Fix T1/T3 privacy violations in batch 4a schemas: move plaintext columns that belong in encrypted_data blobs (senderId, replyToId, voter, etc.), add missing slug column to wikiPages, use archivable() helper consistently, fix nullable encryptedData in pollVotes, remove POLL_KINDS enum

## Summary of Changes

- Removed T1 plaintext columns from server schemas (senderId, replyToId, voter, optionId, isVeto, votedAt, createdByMemberId, targetMemberId, kind, endsAt, allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto, author, frontingSessionId) — these belong in encrypted_data blobs
- Added slug column (NOT NULL) to wikiPages with unique(system_id, slug) index
- Made pollVotes.encryptedData NOT NULL
- Replaced manual archived/archivedAt columns with ...archivable() helper on messages and journalEntries
- Added CHECK(sort_order >= 0) constraint to boardMessages
- Removed ...timestamps() and ...versioned() from acknowledgements and pollVotes (only need createdAt)
- Removed POLL_KINDS enum and kind CHECK constraint from polls
- Fixed POLL_STATUSES satisfies type to use ServerPoll["status"]
- Updated all PG and SQLite DDL test helpers and integration tests to match
- Added missing SQLite parity tests
