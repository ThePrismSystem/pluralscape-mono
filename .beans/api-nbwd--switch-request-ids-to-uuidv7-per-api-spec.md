---
# api-nbwd
title: Switch request IDs to UUIDv7 per API spec
status: todo
type: task
priority: low
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

request-id.ts uses crypto.randomUUID() (UUIDv4). API spec defines UUIDv7. Ref: audit S-14.
