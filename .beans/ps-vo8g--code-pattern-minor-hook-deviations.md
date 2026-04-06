---
# ps-vo8g
title: "Code pattern: minor hook deviations"
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T09:45:50Z
parent: ps-y621
---

Minor pattern deviations (functional but inconsistent):

1. ~~use-custom-fronts.ts:101 — includeArchived extracted to local variable~~ **FIXED** — now inlined like every other hook.

2. use-fronting-sessions.ts:33-34 — local TRPCMutationCtx type alias used only in that file. Pattern elsewhere uses shared TRPCMutation type.

3. use-fronting-sessions.ts:20-21 — only hook that imports tRPC/React Query result types directly rather than using shared types barrel.

4. ~~use-friend-codes.ts:52 — uses TRPCMutation<..., void>~~ **NOT A DEVIATION** — void is correct for no-input endpoints.

5. apps/mobile/src/hooks/types.ts:14 — TRPCInfiniteQuery<T> used by only 7 files, most infinite queries now use DataListQuery.

Audit ref: Pass 5 LOW

## Summary of Changes

Item 2: Moved TRPCMutationCtx from use-fronting-sessions.ts to shared hooks/types.ts. Removed direct imports from @tanstack/react-query and @trpc/react-query/shared.
Item 4: TRPCInfiniteQuery left as-is — 5 active consumers, not dead.
Items 1, 3: Already fixed / not a deviation.
