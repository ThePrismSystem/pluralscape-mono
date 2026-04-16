---
# ps-b9ys
title: 'Fix PR #454 review issues'
status: completed
type: task
priority: normal
created_at: 2026-04-16T12:31:42Z
updated_at: 2026-04-16T12:36:26Z
---

Address 6 review findings from PR #454: propagate failureReason, discriminated union, test fixes, as const, branded keyVersion, stronger zeroing test

## Summary of Changes

1. Added `failureReason` to `CompletionItem` and propagated it in `processChunk`
2. Converted `ItemProcessResult` to a discriminated union
3. Fixed test to assert `failureReason` value instead of comment placeholder
4. Added `as const` to `CryptoError.name` (kept `: string` annotation for subclass compat)
5. Branded `keyVersion` as `KeyVersion` in internal `buildEnvelope`/`parseEnvelope` functions
6. Strengthened error-path zeroing test with `toHaveBeenCalledTimes(2)` and buffer size checks
