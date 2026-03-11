---
# db-5hkc
title: Application-layer encryption round-trip tests
status: todo
type: task
priority: high
created_at: 2026-03-11T08:09:02Z
updated_at: 2026-03-11T08:09:02Z
parent: db-2je4
---

DB integration tests use testBlob() (fake EncryptedBlob) to test schema round-trips. This verifies DB storage but cannot verify that fields survive a real encrypt/decrypt cycle. Need integration tests that exercise the actual crypto helpers to ensure T1 fields are correctly packed into and unpacked from encryptedData.

Blocked by: crypto helpers implementation (packages/crypto encrypt/decrypt for each entity type).

## Tasks

- [ ] Create test fixtures with real field data for each entity type
- [ ] Write encrypt round-trip tests (client -> encrypt -> insert -> select -> decrypt -> compare)
- [ ] Cover all entity types with T1 encrypted fields
- [ ] Test error cases (corrupted blob, wrong key, missing fields)
