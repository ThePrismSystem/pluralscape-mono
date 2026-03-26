---
# api-gbzy
title: Remove nested transaction in webhook dispatcher
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T07:58:58Z
parent: ps-106o
---

dispatchWebhookEvent wraps its body in db.transaction(), but every caller already passes a transaction handle from withTenantTransaction. This creates an unnecessary SAVEPOINT + RELEASE SAVEPOINT on every single write operation.

## File

- webhook-dispatcher.ts:25

## Fix

Remove the db.transaction() wrapper; operate directly on the passed transaction handle.

## Tasks

- [ ] Remove nested transaction wrapper
- [ ] Verify all callers pass tx correctly
- [x] Run integration tests

## Summary of Changes

Removed db.transaction() wrapper from dispatchWebhookEvent. The function now operates directly on the passed db/tx parameter, eliminating unnecessary SAVEPOINT overhead on every write operation.
