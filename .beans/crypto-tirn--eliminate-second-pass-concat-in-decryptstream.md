---
# crypto-tirn
title: Eliminate second-pass concat in decryptStream
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T12:10:36Z
parent: crypto-cpir
---

Finding [PERF-2] from audit 2026-04-20. packages/crypto/src/symmetric.ts:104-128. Parts accumulate in array, then reduce + second loop copies into final Uint8Array. Fix: pre-allocate result using payload.totalLength and write directly per chunk.

## Summary of Changes

decryptStream now pre-allocates the output Uint8Array using payload.totalLength and writes chunks at tracked offsets. Eliminates the array-of-parts plus reduce+second-pass concat.

- `packages/crypto/src/symmetric.ts`: reworked `decryptStream` to single-allocation; added upfront totalLength sanity check and an overflow guard before each `set`.
- `packages/crypto/src/__tests__/symmetric.test.ts`: added multi-MiB round-trip and tampered-totalLength regression tests.

Peak heap during decrypt drops from (decrypted-parts array + final buffer) to (final buffer only). The existing truncation/reorder AAD defences are preserved and the new guards give explicit DecryptionFailedError for negative / NaN / undersized totalLength instead of a RangeError surfacing from `Uint8Array.set`.
