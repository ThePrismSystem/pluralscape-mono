---
# infra-h4oi
title: sp-seed env test turns the host repo bare when run from a worktree hook
status: completed
type: bug
priority: normal
created_at: 2026-11-05T16:00:39Z
updated_at: 2026-11-05T16:00:39Z
---

Git exports GIT_DIR to hooks. A pre-push hook run from a linked worktree points it at the worktree's gitdir, and the pre-push hook runs the unit suite. The writeEnvFile suite in scripts/sp-seed/**tests**/env.test.ts runs `git init` in a temp dir with the inherited environment, so git reinitializes the host repository instead and sets core.bare=true in its shared config. The main checkout then fails every work-tree command with "this operation must be run in a work tree". The `git check-ignore` call in writeEnvFile also inherits GIT_DIR and checks against the host repository.

## Summary of Changes

- The writeEnvFile suite clears every inherited GIT_* variable with vi.stubEnv before its temp-repo `git init` and restores them afterward, so both that call and the `git check-ignore` in writeEnvFile target the temp directory.
- Reproduced by running the suite with GIT_DIR set to a decoy repository's worktree gitdir: before the fix the decoy flipped to core.bare=true, after it the decoy is unchanged and all 8 tests pass.
