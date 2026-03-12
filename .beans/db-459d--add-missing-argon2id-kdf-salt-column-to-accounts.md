---
# db-459d
title: Add missing Argon2id KDF salt column to accounts
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-12T06:30:59Z
parent: db-2nr7
---

accounts has emailSalt but no kdfSalt/pwhash_salt. ADR 006 requires deterministic MasterKey derivation from password + salt. Cross-device login cannot work without KDF salt persisted server-side. Ref: audit CR8

## Summary of Changes\n\nMade `kdfSalt` NOT NULL on both PG and SQLite `accounts` tables. Updated test helpers, insert functions, and test assertions to match.
