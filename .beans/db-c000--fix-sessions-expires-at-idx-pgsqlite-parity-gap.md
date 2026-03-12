---
# db-c000
title: Fix sessions_expires_at_idx PG/SQLite parity gap
status: completed
type: bug
priority: low
created_at: 2026-03-12T07:48:48Z
updated_at: 2026-03-12T10:02:18Z
parent: db-2nr7
---

PG has sessions_expires_at_idx as a partial index (WHERE expires_at IS NOT NULL) but SQLite has it as a plain non-partial index. SQLite supports partial indexes since 3.8.9, so the SQLite schema should match PG. Surfaced during PR #72 review.

## Summary of Changes\n\nAdded WHERE clauses to two SQLite indexes to match PG partial index behavior:\n- `sessions_expires_at_idx`: WHERE expires_at IS NOT NULL\n- `recovery_keys_revoked_at_idx`: WHERE revoked_at IS NULL\n\nUpdated both schema and test DDL.
