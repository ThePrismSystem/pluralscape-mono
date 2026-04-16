---
# ps-i5p8
title: Zero-knowledge audit fixes (F1, F3, M2)
status: completed
type: task
priority: normal
created_at: 2026-04-16T03:30:56Z
updated_at: 2026-04-16T03:31:00Z
---

Fixes from zero-knowledge compliance audit (2026-04-15):

- [x] F1: Add deployment-mode guard to search index searchEntries() and deleteSearchEntry()
- [x] F3: Make webhook payload encryption mandatory, remove plaintext fallback
- [x] M2: Change pkTokenEncrypted from pgBinary to pgEncryptedBlob
- [x] Update database-schema.md diagram
- [x] Fix board-message integration test for mandatory encryption

Branch: fix/zero-knowledge-audit-fixes

## Summary of Changes

- `searchEntries()` and `deleteSearchEntry()` now check `assertSelfHosted()` before operating on plaintext search index
- `getWebhookPayloadEncryptionKey()` throws instead of returning null; webhook dispatcher always encrypts
- `pk_bridge_configs.pkTokenEncrypted` changed from raw binary to EncryptedBlob (T1) on both PG and SQLite schemas
- Created bean `client-cde3` for client-side PK token encryption when PK bridge is implemented
- Created bean `sync-qj9u` for sync conflict persistence with E2E encryption
