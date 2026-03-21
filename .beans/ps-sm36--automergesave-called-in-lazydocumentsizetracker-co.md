---
# ps-sm36
title: Automerge.save() called in LazyDocumentSizeTracker constructor
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:00:21Z
parent: ps-i3xl
---

Defer to first increment(), compaction.ts:43

## Summary of Changes\n\nDeferred Automerge.save() from LazyDocumentSizeTracker constructor to first increment() call. Constructor no longer takes a doc parameter.
