---
# ps-o72l
title: Provider tree & auth flow
status: in-progress
type: epic
priority: normal
created_at: 2026-03-31T23:12:32Z
updated_at: 2026-04-01T05:57:19Z
parent: ps-7j8n
---

React Query provider, auth context (login/register/session/biometric), encryption key management, i18n provider


## Summary of Changes

Provider tree and auth flow implemented in feat/m8-app-foundation (PR #352):
- AuthStateMachine (pure logic: LOGIN/LOCK/UNLOCK/LOGOUT transitions)
- AuthProvider React context with useSyncExternalStore
- Platform-adapted token store (expo-secure-store on mobile, IndexedDB on web)
- BiometricKeyStore for biometric-protected master key
- RecoveryKeyService wrapping crypto recovery functions
- SessionRefreshService with platform-aware timeouts
- React Query provider setup with configured defaults
- i18n completion: device language detection, RTL, lazy namespace loading, nomenclature wiring
