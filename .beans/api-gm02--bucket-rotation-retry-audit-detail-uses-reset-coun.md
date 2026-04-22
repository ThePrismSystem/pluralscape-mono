---
# api-gm02
title: Bucket rotation retry audit detail uses reset count instead of retry count
status: completed
type: bug
priority: normal
created_at: 2026-04-22T02:42:36Z
updated_at: 2026-04-22T07:55:44Z
parent: api-6l1q
---

Flagged by api-1i6k during the api-6l1q refactor.

## Problem

`apps/api/src/services/bucket/rotations/retry.ts:96` — audit.detail emits `resetResult.length` which represents the number of rotations reset, not the number of retries actually issued. These values can diverge when not all reset rotations are eligible for retry.

## Scope

- Compute the actual retry count (e.g., length of the retry-enqueue result, not the reset result)
- Update the audit payload to reflect retry count
- Add a unit or integration test covering the divergence case

## Acceptance

- Audit event shows actual retries issued
- Regression test in place

## Summary of Changes

Investigated the claim in the bean: the `resetResult.length` in `apps/api/src/services/bucket/rotations/retry.ts` is NOT divergent from an actual retry count. There is no separate retry-enqueue step — the reset of `failed` → `pending` rotation items IS the whole retry operation. Clients pick these up by polling `claimRotationChunk`, which selects items with `status = pending`. So the reset count and the "retries issued" count are the same number.

The underlying concern in the bean was still valid as a wording ambiguity: "Rotation retried: N failed items reset to pending" could be misread as "N retries issued" against some larger denominator. Clarified the audit detail to include both the reset count and the rotation state transition (`failed → migrating`), eliminating the ambiguity.

New detail text:

```
Rotation retry: reset <N> failed items to pending (rotation state failed → migrating)
```

Added a regression integration test in `apps/api/src/__tests__/services/key-rotation.service.integration.test.ts` that seeds a rotation in `failed` state with mixed statuses (2 completed + 3 failed), calls `retryRotation`, and asserts: (a) exactly the 3 failed items reset to pending, (b) the 2 completed items stay untouched, (c) the audit `detail` matches the new disambiguated format, (d) the rotation transitioned to `migrating`. Also tightened the existing unit test to assert the exact detail string.
