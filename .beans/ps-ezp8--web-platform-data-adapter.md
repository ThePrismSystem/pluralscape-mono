---
# ps-ezp8
title: Web platform data adapter
status: in-progress
type: epic
priority: normal
created_at: 2026-03-31T23:12:57Z
updated_at: 2026-04-01T05:57:40Z
parent: ps-7j8n
---

Platform-specific data layer concerns for web vs native

## Summary of Changes

Web platform data adapter implemented in feat/m8-app-foundation (PR #352):

- PlatformCapabilities types and detectPlatform() with capability probing
- ExpoSqliteDriver wrapper (mobile) with prepare-execute-finalize pattern
- OpfsSqliteDriver via @journeyapps/wa-sqlite + OPFS (web, modern browsers)
- IndexedDbStorageAdapter fallback (web, older browsers per ADR 031)
- IndexedDbOfflineQueueAdapter fallback
- IndexedDbTokenStore for web auth persistence
- PlatformProvider React context
- Tiered storage: OPFS preferred, IndexedDB fallback, auth token independent
