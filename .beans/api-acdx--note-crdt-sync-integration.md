---
# api-acdx
title: Note CRDT sync integration
status: todo
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-i16z
---

Notes get their own NoteDocument CRDT schema (independent from ChatDocument). Create packages/sync/src/schemas/notes.ts with CrdtNote and NoteDocument types. Wire into document factory and subscription profiles. Tests: unit (document factory, merge, independent sync).
