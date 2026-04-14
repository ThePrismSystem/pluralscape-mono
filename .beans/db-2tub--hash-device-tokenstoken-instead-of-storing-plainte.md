---
# db-2tub
title: Hash device_tokens.token instead of storing plaintext
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:50Z
updated_at: 2026-04-14T09:28:50Z
---

AUDIT [DB-S-H3] Push notification tokens stored as plaintext varchar(512). Sessions and API keys use tokenHash. DB breach exposes live push tokens for all registered devices.
