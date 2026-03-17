---
# api-ml3l
title: Extract shared toHex utility
status: todo
type: task
priority: low
created_at: 2026-03-17T04:00:47Z
updated_at: 2026-03-17T04:00:47Z
parent: api-o89k
---

auth.service.ts and email-hash.ts both implement hex encoding via Array.from().map().join(). Extract to a shared utility in lib/hex.ts.
