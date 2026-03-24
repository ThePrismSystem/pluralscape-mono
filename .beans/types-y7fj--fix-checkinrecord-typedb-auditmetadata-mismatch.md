---
# types-y7fj
title: Fix CheckInRecord type/DB AuditMetadata mismatch
status: completed
type: bug
priority: high
created_at: 2026-03-24T09:21:12Z
updated_at: 2026-03-24T09:28:18Z
parent: ps-4ioj
---

CheckInRecord extends AuditMetadata (createdAt, updatedAt, version) but DB table has only archivable() - no timestamps() or versioned(). Type expects fields that don't exist in DB.

## Summary of Changes\n\nRemoved AuditMetadata from CheckInRecord (DB has no createdAt/updatedAt/version). Added archivedAt field. Added CheckInRecordStatus type. Changed ArchivedCheckInRecord to explicit interface. Updated type tests.
