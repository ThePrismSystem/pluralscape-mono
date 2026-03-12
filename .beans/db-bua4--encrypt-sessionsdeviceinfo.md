---
# db-bua4
title: Encrypt sessions.deviceInfo
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T08:32:02Z
parent: db-2nr7
---

OS/browser string is readable by server operator. Move into encryptedData or encrypt at application layer. Ref: audit M10

## Summary of Changes\n\nAdded nullable `encrypted_data BYTEA` column to sessions table in both PG and SQLite schemas. Updated DDL helpers and added integration tests for round-trip and null default. Updated tier map: `Session: T1 (deviceInfo) | T3 (accountId, revoked, timestamps)`.
