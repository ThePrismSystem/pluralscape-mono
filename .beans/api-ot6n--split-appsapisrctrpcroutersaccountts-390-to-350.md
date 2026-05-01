---
# api-ot6n
title: Split apps/api/src/trpc/routers/account.ts (390 to <=350)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:12Z
updated_at: 2026-04-30T22:03:21Z
parent: ps-r5p7
---

## Summary of Changes

Split routers/account.ts (390 LOC) into barrel pattern:

- apps/api/src/trpc/routers/account.ts (199 LOC) — barrel composing all procedures
- apps/api/src/trpc/routers/account/device-transfer.ts (211 LOC) — initiateDeviceTransfer, approveDeviceTransfer, completeDeviceTransfer

Device-transfer procedures exported as plain object (deviceTransferProcedures) spread into accountRouter, keeping all 16 procedures flat under account.\* matching REST parity. Typecheck, lint, trpc:parity all pass. 5245/5245 tests pass.
