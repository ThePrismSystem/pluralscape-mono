---
# types-1fay
title: Add journal polymorphic authorship and fronting positionality
status: completed
type: task
priority: normal
created_at: 2026-03-09T11:09:44Z
updated_at: 2026-04-16T07:29:41Z
parent: types-im7i
---

Journal entries can be authored by members or structure entities (subsystems, side systems, layers). Add positionality text field to fronting sessions.

## Summary of Changes

- `journal.ts`: `authorMemberId: MemberId | null` → `author: EntityReference<...> | null`
- `fronting.ts`: added `positionality: string | null` to both session types
- `encryption.ts`: updated `ServerJournalEntry.author` field and tier map comments
- Updated tests in `journal.test.ts` and `fronting.test.ts`
- Updated `features.md` sections 2 (positionality) and 7 (polymorphic authorship)
