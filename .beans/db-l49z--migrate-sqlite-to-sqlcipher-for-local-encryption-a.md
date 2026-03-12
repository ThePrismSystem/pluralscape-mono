---
# db-l49z
title: Migrate SQLite to SQLCipher for local encryption-at-rest
status: todo
type: task
priority: deferred
created_at: 2026-03-12T11:20:43Z
updated_at: 2026-03-12T11:20:43Z
---

Currently using better-sqlite3 during development. Per ADR 006, production mobile releases need SQLCipher for encrypting the local SQLite database at rest. This protects locally cached data if the device is compromised. Requires evaluating SQLCipher npm packages, updating the drizzle configuration, and testing with the existing schema.
