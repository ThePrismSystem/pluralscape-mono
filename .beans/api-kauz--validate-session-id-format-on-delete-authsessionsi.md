---
# api-kauz
title: Validate session ID format on DELETE /auth/sessions/:id
status: completed
type: bug
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

Session :id parameter on DELETE is used directly without parseIdParam() validation. Not exploitable but inconsistent. Ref: audit S-9.

## Summary of Changes\n\nAdded `parseIdParam(c.req.param("id"), "sess_")` validation to the DELETE /auth/sessions/:id handler. Invalid session IDs now return 400 VALIDATION_ERROR. Updated test to use properly formatted session IDs.
