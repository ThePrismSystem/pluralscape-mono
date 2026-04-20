---
# api-qcs0
title: Device transfer completeTransfer status check is wrong
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [M1 elevated due to correctness] from audit 2026-04-20. apps/api/src/services/device-transfer.service.ts:232. completeTransfer checks status=pending but approveTransfer sets status=approved. Logic bug means approval step provides no actual gate. Fix: filter for status=approved; add end-to-end test.
