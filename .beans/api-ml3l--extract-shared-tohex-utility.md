---
# api-ml3l
title: Extract shared toHex utility
status: completed
type: task
priority: low
created_at: 2026-03-17T04:00:47Z
updated_at: 2026-03-17T05:33:29Z
parent: api-o89k
---

auth.service.ts and email-hash.ts both implement hex encoding via Array.from().map().join(). Extract to a shared utility in lib/hex.ts.

## Summary of Changes\n\nExtracted toHex() from auth.service.ts and email-hash.ts into lib/hex.ts with constants in lib/hex.constants.ts. Removed HEX_RADIX and HEX_BYTE_WIDTH from auth.constants.ts. Added 5 unit tests.
