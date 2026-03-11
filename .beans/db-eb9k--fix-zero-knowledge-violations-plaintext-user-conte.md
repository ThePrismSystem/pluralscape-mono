---
# db-eb9k
title: Fix zero-knowledge violations — plaintext user content
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T05:53:20Z
parent: db-2je4
---

journal_entries.author (JSONB) contains member identity in plaintext — breaks zero-knowledge. messages.sender_id (varchar) lets server read message attribution. innerworldRegions.gatekeeperMemberIds (JSONB array) reveals access control structure. Move all into encryptedData. Ref: audit CR5

## Tasks

- [x] Remove journal_entries.author JSONB column (PG + SQLite)
- [x] Remove innerworldRegions.gatekeeperMemberIds JSONB column (PG + SQLite)
- [x] Update tier map comments in encryption.ts
- [x] Update ServerJournalEntry (remove author field)
- [x] Update ServerInnerWorldRegion (remove gatekeeperMemberIds field)
- [x] Update test helpers DDL
- [x] Update integration tests
- [x] Verify all tests pass

## Summary of Changes

Moved `journal_entries.author` and `innerworldRegions.gatekeeperMemberIds` from T3 plaintext to T1 encrypted (inside `encryptedData`). Removed the plaintext columns from PG and SQLite schemas, updated `ServerJournalEntry` and `ServerInnerWorldRegion` types, updated tier map comments, and fixed all test helpers and integration tests. `layers.gatekeeperMemberIds` intentionally remains T3 per the tier map.
