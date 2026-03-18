---
# api-fj88
title: Hash session tokens and redact from listings and audit logs
status: todo
type: bug
priority: high
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:12:32Z
parent: api-i2pw
---

Raw session bearer token is stored as DB sessions.id (not hashed), returned by listSessions, and logged in audit detail strings. Store BLAKE2b(token) as session ID, return only opaque display-safe identifiers, truncate/hash in audit logs. Ref: audit S-4.
