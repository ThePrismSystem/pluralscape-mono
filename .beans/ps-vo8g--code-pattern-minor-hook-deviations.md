---
# ps-vo8g
title: "Code pattern: minor hook deviations"
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T00:53:47Z
parent: ps-y621
---

Minor pattern deviations (functional but inconsistent):

1. use-custom-fronts.ts:101 — includeArchived extracted to local variable before hooks section. Every other hook inlines opts?.includeArchived ?? false directly.

2. use-fronting-sessions.ts:33-34 — local TRPCMutationCtx type alias used only in that file. Pattern elsewhere uses shared TRPCMutation type.

3. use-fronting-sessions.ts:20-21 — only hook that imports tRPC/React Query result types directly rather than using shared types barrel.

4. use-friend-codes.ts:52 — uses TRPCMutation<..., void> for variables. Unique pattern (correct — no input).

5. apps/mobile/src/hooks/types.ts:14 — TRPCInfiniteQuery<T> used by only 7 files, most infinite queries now use DataListQuery.

Audit ref: Pass 5 LOW
