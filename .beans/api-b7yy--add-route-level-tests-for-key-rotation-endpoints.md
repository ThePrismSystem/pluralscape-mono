---
# api-b7yy
title: Add route-level tests for key rotation endpoints
status: completed
type: task
priority: critical
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:50Z
parent: api-i2pw
---

Bucket key rotation routes (initiate, claim, complete-chunk, progress) have zero route-level tests. Security-critical operation. Ref: audit T-2.

## Test Files

- [ ] `apps/api/src/__tests__/routes/buckets/rotations/initiate.test.ts` — POST /systems/:id/buckets/:bucketId/rotations
  - 201 success: creates rotation record, bulk-inserts rotation items, revokes old key grants
  - 400 invalid body (InitiateRotationBodySchema)
  - 409 conflict: active rotation already running (migrating/sealing state)
  - Auto-cancels unclaimed "initiated" rotations before creating new one
  - Triple-nested URL params: systemId (sys*), bucketId (bkt*) validated via parseIdParam
  - Audit trail: bucket.key_rotation.initiated event written
  - write rate limiter applied

- [ ] `apps/api/src/__tests__/routes/buckets/rotations/claim.test.ts` — POST /systems/:id/buckets/:bucketId/rotations/:rotationId/claim
  - 200 success: returns claimed items and current rotation state
  - 400 invalid body (ClaimChunkBodySchema — chunkSize)
  - 404 rotation not found or doesn't belong to system/bucket
  - Only claims when rotation state is "initiated" or "migrating"
  - State transition: "initiated" → "migrating" on first claim
  - Reclaims stale items older than KEY_ROTATION.staleClaimTimeoutMs
  - Sets claimedBy (sessionId) and claimedAt on claimed items
  - Triple-nested URL params: systemId, bucketId, rotationId (bkr\_)
  - NOTE: No audit writer — only chunk completion logs

- [ ] `apps/api/src/__tests__/routes/buckets/rotations/complete-chunk.test.ts` — POST /systems/:id/buckets/:bucketId/rotations/:rotationId/complete
  - 200 success: updates item statuses, returns rotation + transitioned flag
  - 400 invalid body (CompleteChunkBodySchema — items array with status + itemId)
  - 404 rotation not found
  - Only accepts rotation in "migrating" state
  - State transitions: migrating → completed (all done, zero failures), migrating → failed (all done, failures > 0)
  - Stays in "migrating" when new items detected mid-rotation (sealing phase)
  - Increments attempt counter; marks items failed when exceeding KEY_ROTATION.maxItemAttempts
  - Audit: bucket.key_rotation.chunk_completed (always), plus .failed or .completed on transition
  - Transaction: locks rotation FOR UPDATE to prevent concurrent transitions

- [ ] `apps/api/src/__tests__/routes/buckets/rotations/progress.test.ts` — GET /systems/:id/buckets/:bucketId/rotations/:rotationId
  - 200 success: returns rotation progress (completedItems, failedItems, totalItems, state)
  - 404 rotation not found or doesn't belong to system/bucket
  - Read-only, no rate limiter, no audit

## Implementation Notes

- Pattern: `__tests__/routes/custom-fronts/crud.test.ts`
- Mock: key-rotation service methods (initiateRotation, claimRotationChunk, completeRotationChunk, getRotationProgress), auth middleware, rate-limit middleware, system-ownership
- Triple-nested params: URL format is `/systems/sys_.../buckets/bkt_.../rotations/bkr_.../...`
- claim.ts has NO createAuditWriter — do not mock audit for claim tests
- complete-chunk uses transactions — mock chain.transaction if testing service interactions

## Summary of Changes

Created 4 route-level test files in `apps/api/src/__tests__/routes/buckets/rotations/`:

- initiate.test.ts (6 tests)
- claim.test.ts (5 tests)
- complete-chunk.test.ts (5 tests)
- progress.test.ts (4 tests)

All 20 tests pass.
