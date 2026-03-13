---
# db-bbra
title: Document webhookConfigs.secret encryption tier (server-signed vs client-signed)
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:39:58Z
parent: db-hcgk
---

## Summary of Changes

Added JSDoc to `webhookConfigs.secret` in both PG and SQLite schema files documenting it as T3 (server-readable) — the server needs to read the raw HMAC signing key to sign outbound webhook payloads. Updated encryption tier from the incorrect "T1" in the tier map to T3.
