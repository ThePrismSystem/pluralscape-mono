---
# db-4o4t
title: Add revocation timestamp to recoveryKeys
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T03:06:53Z
parent: db-764i
---

No revocation timestamp for rejecting old recovery keys after regeneration. A user who photographed their old recovery key could still use it. Ref: audit M16

## Summary of Changes\n\nAdded nullable `revokedAt` column to recoveryKeys table (PG and SQLite) with index. Updated test helper DDL and added integration tests for null default and round-trip.
