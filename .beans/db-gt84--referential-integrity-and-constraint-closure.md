---
# db-gt84
title: Referential integrity and constraint closure
status: completed
type: feature
priority: normal
created_at: 2026-03-11T19:39:32Z
updated_at: 2026-03-12T00:50:51Z
parent: db-2je4
---

Add all missing FK constraints, CHECK constraints, and unique constraints. Data integrity enforced by the DB, not application code.

## Consolidates

db-evu5, db-118h, db-8bac, db-nzax, db-u7wd, db-m3vj, db-6v0i, db-5sup, db-2g05, db-k85r, db-hd6z

## Tasks

- [x] Add missing FK constraints for nullable member references (db-evu5)
- [x] ~~Add FK constraints for messages.senderId and acknowledgements.targetMemberId (db-118h)~~ — invalidated by ZK hardening
- [x] ~~Fix bucket_content_tags polymorphic entityId with no FK (db-8bac)~~ — documented limitation, follow-up db-7qzc
- [x] ~~Fix innerworldRegions.gatekeeperMemberIds FK enforcement (db-nzax)~~ — invalidated by ZK contract
- [x] ~~Add composite unique constraints to membership tables (db-u7wd)~~ — invalidated by ZK contract
- [x] Add partial unique indexes to fieldValues (db-m3vj)
- [x] Add consistency CHECK to syncConflicts resolution/resolvedAt (db-6v0i)
- [x] Add CHECK constraint to archivable() helper (db-5sup)
- [x] Add >= 1 check to versioned() helper itself (db-2g05)
- [x] Make blobMetadata.checksum non-nullable (db-k85r)
- [x] Add versioned() to switches table (db-hd6z)

## Summary of Changes

All 11 sub-beans resolved across 6 commits:

1. Version and archivable CHECK helpers (db-2g05, db-5sup)
2. Versioned switches (db-hd6z)
3. Non-nullable checksum (db-k85r)
4. syncConflicts consistency CHECK (db-6v0i)
5. FK constraints for nullable member references (db-evu5)
6. Partial unique indexes on fieldValues (db-m3vj)

3 sub-beans invalidated by ZK contract hardening (db-118h, db-nzax, db-u7wd).
1 sub-bean closed with documented limitation + follow-up bean db-7qzc (db-8bac).
