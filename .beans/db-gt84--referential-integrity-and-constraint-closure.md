---
# db-gt84
title: Referential integrity and constraint closure
status: in-progress
type: feature
priority: normal
created_at: 2026-03-11T19:39:32Z
updated_at: 2026-03-11T23:50:03Z
parent: db-2je4
---

Add all missing FK constraints, CHECK constraints, and unique constraints. Data integrity enforced by the DB, not application code.

## Consolidates

db-evu5, db-118h, db-8bac, db-nzax, db-u7wd, db-m3vj, db-6v0i, db-5sup, db-2g05, db-k85r, db-hd6z

## Tasks

- [ ] Add missing FK constraints for nullable member references (db-evu5)
- [ ] Add FK constraints for messages.senderId and acknowledgements.targetMemberId (db-118h)
- [ ] Fix bucket_content_tags polymorphic entityId with no FK (db-8bac)
- [ ] Fix innerworldRegions.gatekeeperMemberIds FK enforcement (db-nzax)
- [ ] Add composite unique constraints to membership tables (db-u7wd)
- [ ] Add unique constraint on fieldValues (fieldDefinitionId, systemId) (db-m3vj)
- [ ] Add consistency CHECK to syncConflicts resolution/resolvedAt (db-6v0i)
- [ ] Add CHECK constraint to archivable() helper (db-5sup)
- [ ] Add >= 1 check to versioned() helper itself (db-2g05)
- [ ] Make blobMetadata.checksum non-nullable (db-k85r)
- [ ] Add versioned() to switches table (db-hd6z)
