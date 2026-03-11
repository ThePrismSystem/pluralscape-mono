---
# db-459d
title: Add missing Argon2id KDF salt column to accounts
status: todo
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T04:47:30Z
parent: db-2je4
---

accounts has emailSalt but no kdfSalt/pwhash_salt. ADR 006 requires deterministic MasterKey derivation from password + salt. Cross-device login cannot work without KDF salt persisted server-side. Ref: audit CR8
