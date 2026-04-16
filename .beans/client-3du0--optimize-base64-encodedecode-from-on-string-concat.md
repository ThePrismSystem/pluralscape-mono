---
# client-3du0
title: Optimize base64 encode/decode from O(n) string concat to Buffer
status: completed
type: task
priority: normal
created_at: 2026-04-14T09:29:29Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
---

AUDIT [CLIENT-P-M1, DATA-P-M1] uint8ArrayToBase64/base64ToUint8Array use byte-by-byte string concatenation. Hot path for all crypto transforms. Buffer.from is ~10x faster. Affects both api-client and data packages.

## Summary of Changes\n\nReplaced O(n) byte-by-byte string concatenation in base64ToUint8Array and uint8ArrayToBase64 with Buffer.from() calls in packages/data/src/transforms/decode-blob.ts.
