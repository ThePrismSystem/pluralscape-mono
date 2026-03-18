---
# api-lqns
title: Use 204 No Content for void operations
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T08:04:07Z
parent: api-i2pw
---

Delete/archive/restore operations return 200 with body {ok:true} instead of 204 No Content. The {ok:true} field is not part of the typed error/success envelope. Ref: audit P-9.

## Summary of Changes\n\nReplaced `return c.json({ ok: true })` with `return c.body(null, 204)` across 29 route handler files (34 occurrences total). Updated 10 test files to expect 204 status and no response body for void operations.
