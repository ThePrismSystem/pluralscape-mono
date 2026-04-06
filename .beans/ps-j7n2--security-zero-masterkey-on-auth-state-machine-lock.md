---
# ps-j7n2
title: "Security: zero masterKey on auth state machine LOCK/LOGOUT"
status: todo
type: bug
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T00:52:27Z
parent: ps-y621
---

AuthStateMachine LOCK event drops masterKey reference but does not memzero it. The old InternalState object containing the KdfMasterKey Uint8Array is left for GC without zeroing. MobileKeyLifecycleManager has proper zeroing but AuthStateMachine does not.

Fix: accept a memzero callback in the state machine and zero the masterKey on LOCK/LOGOUT transitions.

File: apps/mobile/src/auth/auth-state-machine.ts:83-84
Audit ref: Pass 2 HIGH
