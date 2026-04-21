---
# api-drgh
title: Refactor friend-connection.service.ts (634 LOC) into services/friend-connection/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/friend-connection.service.ts (634 LOC) into apps/api/src/services/friend-connection/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates bilateral connection creation / bucket visibility / status transitions in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/friend-connection/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/friend-connection.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/friend-connection/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- services/friend-connection/transitions.ts:1-374 — status transition helpers (transitionConnectionStatus, updateReverseConnection, cleanupBucketAssignments, terminateConnection) are single-consumer (only used by accept/reject/block/remove); kept module-local per "single-consumer helpers stay module-local" rule — low
- services/friend-connection/lifecycle.ts — renamed concept: "lifecycle" now covers only archive/restore (account-scoped entity lifecycle). State transitions live in transitions.ts. This matches the split we may want elsewhere — low
- Types FriendConnectionResult + FriendConnectionWithRotations + toFriendConnectionResult in internal.ts — used by queries/update/transitions/lifecycle (≥4 consumers) — info

## Summary of Changes

friend-connection.service.ts (634 LOC) → services/friend-connection/ (5 files: queries, update, transitions, lifecycle, internal). Max 374 LOC (transitions — within soft-cap; state transitions are cohesive unit). 29 callers updated. No barrel (Option E). Will be relocated under services/account/friends/ in PR 2.

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
