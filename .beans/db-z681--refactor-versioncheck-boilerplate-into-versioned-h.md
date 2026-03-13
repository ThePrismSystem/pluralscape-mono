---
# db-z681
title: Refactor versionCheck boilerplate into versioned() helper
status: in-progress
type: task
priority: low
created_at: 2026-03-12T01:39:41Z
updated_at: 2026-03-13T00:05:16Z
---

The pattern `(t) => [check("foo_version_check", versionCheck(t.version))]` repeats 30+ times across schema files. Could be folded into the versioned() audit helper to reduce boilerplate.

## Worktree Status

Implementation completed in worktree branch `worktree-agent-a2f97a69` (commit 212c121). Changes touch 36 files across all PG and SQLite schema files. Needs cherry-pick with conflict resolution against Phase 1 timers.ts changes before merging.
