---
# api-y19d
title: Address all PR review findings from security audit
status: completed
type: task
priority: normal
created_at: 2026-03-25T00:15:54Z
updated_at: 2026-04-16T07:29:49Z
parent: ps-8al7
---

Fix all 15 findings from PR review: complete RLS wrapping, auth timing, WS IP fallback, type safety, test improvements, simplifications

## Summary of Changes

- Refactored RLS context infrastructure: collapsed read/write duplication, removed `| string` from branded types, added `SET TRANSACTION READ ONLY` enforcement on read variants
- Extracted `tenantCtx()` helper to deduplicate ~60 inline context constructions
- Completed RLS wrapping across all 20+ services (reads and writes)
- Fixed TOCTOU races in key-rotation `claimRotationChunk` and pin `removePin`
- Added login timing equalization for non-existent accounts
- Made throttle error handling symmetric between account-found and not-found paths
- Added socket IP fallback for WebSocket per-IP limiting when TRUST_PROXY=0
- Simplified `generateFakeRecoveryKey` (zero modulo bias with 32-char alphabet)
- Parameterized RLS context tests with `describe.each`
- Added biometric replay test, blob `.for('update')` assertion, fixed `Record<string, unknown>` casts
