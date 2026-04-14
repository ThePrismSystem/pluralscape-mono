---
# client-3du0
title: Optimize base64 encode/decode from O(n) string concat to Buffer
status: todo
type: task
priority: normal
created_at: 2026-04-14T09:29:29Z
updated_at: 2026-04-14T09:29:29Z
---

AUDIT [CLIENT-P-M1, DATA-P-M1] uint8ArrayToBase64/base64ToUint8Array use byte-by-byte string concatenation. Hot path for all crypto transforms. Buffer.from is ~10x faster. Affects both api-client and data packages.
