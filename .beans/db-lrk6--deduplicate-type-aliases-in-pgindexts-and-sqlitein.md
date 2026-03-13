---
# db-lrk6
title: Deduplicate type aliases in pg/index.ts and sqlite/index.ts
status: in-progress
type: task
priority: low
created_at: 2026-03-10T09:03:16Z
updated_at: 2026-03-13T00:05:18Z
---

pg/index.ts and sqlite/index.ts have identical type alias blocks (~30 lines each) that compound with every schema batch. Refactor options: move Row/New types into individual schema files, or create a shared type generation approach.

## Worktree Status

Implementation completed in worktree branch `worktree-agent-a5d0dd5c` (commit 2a0b036). Changes touch 56 files, co-locating Row/New types with table definitions and refactoring index.ts re-exports. Needs cherry-pick with conflict resolution against other schema changes before merging.
