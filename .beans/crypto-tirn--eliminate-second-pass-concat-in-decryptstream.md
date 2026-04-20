---
# crypto-tirn
title: Eliminate second-pass concat in decryptStream
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: crypto-cpir
---

Finding [PERF-2] from audit 2026-04-20. packages/crypto/src/symmetric.ts:104-128. Parts accumulate in array, then reduce + second loop copies into final Uint8Array. Fix: pre-allocate result using payload.totalLength and write directly per chunk.
