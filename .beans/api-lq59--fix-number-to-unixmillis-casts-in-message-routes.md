---
# api-lq59
title: Fix number to UnixMillis casts in message routes
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T08:03:01Z
parent: ps-106o
---

Zod-parsed query.before/query.after/query.timestamp are cast with as UnixMillis instead of using a validated transform. 4 occurrences bypass the branded type system.

## Files

- routes/messages/list.ts:33-34
- routes/messages/get.ts:26
- routes/messages/update.ts:30
- routes/messages/delete.ts:29

## Fix

Add a branded transform to the Zod schemas in validation/message.ts or create a toUnixMillis validation utility.

## Tasks

- [ ] Add UnixMillis branded transform to MessageQuerySchema/MessageTimestampQuerySchema
- [ ] Remove manual casts from route files

## Summary of Changes

Added toUnixMillis branded transforms to MessageQuerySchema and MessageTimestampQuerySchema. Removed 4 manual as UnixMillis casts from message route files.
