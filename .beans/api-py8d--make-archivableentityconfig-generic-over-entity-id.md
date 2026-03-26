---
# api-py8d
title: Make ArchivableEntityConfig generic over entity ID type
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T08:04:48Z
parent: ps-106o
---

onArchive/onRestore callbacks receive entityId: string instead of the branded type, requiring every service to cast back (e.g., eid as NoteId). Affects 10+ type assertions across M5 alone.

## File

- entity-lifecycle.ts:40

## Fix

Make ArchivableEntityConfig generic: ArchivableEntityConfig<TId extends string>. Propagate branded type to callbacks.

## Tasks

- [ ] Add TId generic to ArchivableEntityConfig
- [ ] Update all M5 service lifecycle configs
- [ ] Update all M4 service lifecycle configs
- [ ] Remove now-unnecessary type assertions

## Summary of Changes

Made ArchivableEntityConfig generic over TId. archiveEntity and restoreEntity now propagate branded ID types to callbacks, eliminating type assertions in all service lifecycle configs.
