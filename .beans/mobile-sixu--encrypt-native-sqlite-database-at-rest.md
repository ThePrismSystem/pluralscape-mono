---
# mobile-sixu
title: Encrypt native SQLite database at rest
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:43Z
updated_at: 2026-04-14T09:28:43Z
---

AUDIT [MOBILE-S-H1] pluralscape-sync.db opened with standard expo-sqlite, no SQLCipher or encryption. All local CRDT data (member info, fronting, journal) stored in plaintext. Physical device access or backup extraction exposes all data.
