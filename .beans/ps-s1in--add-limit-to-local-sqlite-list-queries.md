---
# ps-s1in
title: Add LIMIT to local SQLite list queries
status: todo
type: bug
priority: high
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T00:52:54Z
parent: ps-y621
---

All local SQLite list queries (~12 hooks) fetch ALL matching rows with no LIMIT clause. Remote path uses useInfiniteQuery with DEFAULT_LIST_LIMIT=20, but local path does SELECT \* FROM <table> WHERE system_id = ?. For systems with hundreds of entities, this loads everything into memory.

Affected hooks: use-members, use-fronting-sessions, use-messages, use-notes, use-board-messages, use-lifecycle-events, use-custom-fronts, use-channels, use-innerworld-entities, use-relationships, use-privacy-buckets, and more.

Fix: add LIMIT + offset to local queries or implement virtual scrolling.

Audit ref: Pass 3 HIGH
