---
# api-boxz
title: Add tests for pwhash worker thread pool
status: completed
type: task
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:51Z
parent: api-i2pw
---

pwhash-offload.ts and pwhash-worker-thread.ts (Argon2id worker thread pool) are completely untested. Used for PIN operations. Ref: audit T-4.

## Test Files

- [ ] `apps/api/src/__tests__/lib/pwhash-offload.test.ts` — Worker pool manager
  - hashPinOffload: dispatches hash request and returns result
  - verifyPinOffload: dispatches verify request and returns boolean
  - Lazy initialization: pool created on first request only
  - Round-robin distribution across POOL_SIZE (2) workers
  - Worker error handler: rejects ALL pending requests on catastrophic worker failure
  - Worker message error: rejects individual request when response has ok=false
  - \_shutdownPool: terminates all workers, clears pending map, nulls pool ref
  - Re-initialization: pool can be re-created after shutdown
  - Concurrent requests: multiple in-flight requests mapped by incrementing nextId

- [ ] `apps/api/src/__tests__/lib/pwhash-worker-thread.test.ts` — Worker thread message handler
  - "hash" operation: calls hashPin(pin, profile) and returns {id, ok: true, value}
  - "verify" operation: calls verifyPin(hash, pin) and returns {id, ok: true, value}
  - Error handling: catches hashPin/verifyPin exceptions, returns {id, ok: false, error: message}
  - Error extraction: uses .message for Error instances, String(error) for non-Error throws
  - Initialization: eagerly calls initSodium() before processing messages
  - parentPort validation: asserts parentPort exists (must run as Worker)

## Implementation Notes

- Must mock `node:worker_threads` (Worker class, parentPort, workerData) via vi.mock
- For pwhash-offload: mock Worker constructor to capture message handlers, simulate postMessage/onmessage
- For pwhash-worker-thread: mock parentPort.on("message", ...) and parentPort.postMessage(...)
- Mock `@pluralscape/crypto` (hashPin, verifyPin, initSodium)
- Worker file path resolution: workers spawn `pwhash-worker-thread.js` — mock the path
- Test pool lifecycle: init → use → shutdown → re-init

## Summary of Changes

Created 2 test files:

- apps/api/src/**tests**/lib/pwhash-offload.test.ts (9 tests)
- apps/api/src/**tests**/lib/pwhash-worker-thread.test.ts (6 tests)

All 15 tests pass.
