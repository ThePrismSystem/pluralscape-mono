---
# api-gm02
title: Bucket rotation retry audit detail uses reset count instead of retry count
status: todo
type: bug
created_at: 2026-04-22T02:42:36Z
updated_at: 2026-04-22T02:42:36Z
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
