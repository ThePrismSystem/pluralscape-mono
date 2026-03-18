---
# api-nbwd
title: Switch request IDs to UUIDv7 per API spec
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

request-id.ts uses crypto.randomUUID() (UUIDv4). API spec defines UUIDv7. Ref: audit S-14.

## Summary of Changes\n\nReplaced `crypto.randomUUID()` (UUIDv4) with `uuid.v7()` (UUIDv7) in request-id middleware. Added `uuid` as a dependency of `@pluralscape/api`.
