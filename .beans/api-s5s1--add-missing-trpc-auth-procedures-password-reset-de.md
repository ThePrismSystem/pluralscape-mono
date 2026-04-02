---
# api-s5s1
title: Add missing tRPC auth procedures (password reset, device transfer)
status: completed
type: task
priority: normal
created_at: 2026-04-02T09:47:12Z
updated_at: 2026-04-02T10:56:43Z
---

Add 3 missing procedures to auth/account tRPC routers:

- auth.resetPasswordWithRecoveryKey (public, errorMapProcedure)
- auth.initiateDeviceTransfer (protectedProcedure)
- auth.completeDeviceTransfer (protectedProcedure)
  See audit Domain 1.

## Summary of Changes\n\nAdded resetPasswordWithRecoveryKey to auth router, initiateDeviceTransfer + completeDeviceTransfer + deleteAccount to account router
