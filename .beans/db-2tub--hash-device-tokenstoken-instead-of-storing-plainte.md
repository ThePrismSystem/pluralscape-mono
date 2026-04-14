---
# db-2tub
title: Hash device_tokens.token instead of storing plaintext
status: done
type: bug
priority: high
created_at: 2026-04-14T09:28:50Z
updated_at: 2026-04-14T09:28:50Z
---

AUDIT [DB-S-H3] Push notification tokens stored as plaintext varchar(512). Sessions and API keys use tokenHash. DB breach exposes live push tokens for all registered devices.

## Summary of Changes

Replaced plaintext `token` column with `tokenHash` (varchar 64, BLAKE2b hash) in both PG and SQLite device_tokens schemas. Updated device-token service to hash tokens before insert/upsert and lookups via hash. Updated push-notification-worker to pass deviceTokenId to providers instead of plaintext token (M6 stub). Removed token masking logic (no longer needed with hashed storage). Updated all unit, integration, and E2E tests.
