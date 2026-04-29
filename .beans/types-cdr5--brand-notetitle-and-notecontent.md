---
# types-cdr5
title: Brand Note.title and Note.content
status: completed
type: task
priority: normal
created_at: 2026-04-27T21:25:44Z
updated_at: 2026-04-29T06:49:38Z
parent: ps-cd6x
---

Per types-t3tn audit (2026-04-27): Note has both title and content as same-entity free-text peers with symmetric swap risk. Brand NoteTitle and NoteContent as phantom brands so render pipelines (truncation/tooltip vs rich-block) can't accept the wrong field. See docs/local-audits/2026-04-27-free-text-label-brand-audit.md.

## Summary of Changes

Defined NoteTitle and NoteContent brands in packages/types/src/value-types.ts as same-entity peers and applied them to Note.title and Note.content. Re-exported from packages/types/src/index.ts. Updated NoteEncryptedInputSchema in packages/validation/src/note.ts to use brandedString for both fields. Canonical chain inherits brands via existing Pick/Omit projections. Note.content was previously typed z.string() (allowed empty); brandedString tightens to non-empty — no callers or tests depended on empty content.
