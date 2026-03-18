---
# api-kauz
title: Validate session ID format on DELETE /auth/sessions/:id
status: todo
type: bug
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:12:34Z
parent: api-i2pw
---

Session :id parameter on DELETE is used directly without parseIdParam() validation. Not exploitable but inconsistent. Ref: audit S-9.
