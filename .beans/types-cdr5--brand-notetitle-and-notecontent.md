---
# types-cdr5
title: Brand Note.title and Note.content
status: todo
type: task
created_at: 2026-04-27T21:25:44Z
updated_at: 2026-04-27T21:25:44Z
parent: ps-cd6x
---

Per types-t3tn audit (2026-04-27): Note has both title and content as same-entity free-text peers with symmetric swap risk. Brand NoteTitle and NoteContent as phantom brands so render pipelines (truncation/tooltip vs rich-block) can't accept the wrong field. See docs/local-audits/2026-04-27-free-text-label-brand-audit.md.
