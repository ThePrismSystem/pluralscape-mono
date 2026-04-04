---
# ps-h7nj
title: Account management hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:51Z
updated_at: 2026-04-04T19:47:51Z
parent: ps-j47j
---

Deletion flow, PIN management, device transfer

Uses trpc.account.\* for deletion flow, PIN management, and device transfer.

## Summary of Changes

Implemented account management hooks across 3 files:

- use-account.ts: useAccount (query), useChangeEmail, useChangePassword, useUpdateAccountSettings, useDeleteAccount
- use-account-security.ts: useSetPin, useRemovePin, useVerifyPin, useEnrollBiometric, useVerifyBiometric, useRecoveryKeyStatus (query), useRegenerateRecoveryKey
- use-device-transfer.ts: useInitiateDeviceTransfer, useApproveDeviceTransfer, useCompleteDeviceTransfer

All tests passing.
