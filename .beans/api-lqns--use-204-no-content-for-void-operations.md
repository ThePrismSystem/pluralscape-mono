---
# api-lqns
title: Use 204 No Content for void operations
status: todo
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Delete/archive/restore operations return 200 with body {ok:true} instead of 204 No Content. The {ok:true} field is not part of the typed error/success envelope. Ref: audit P-9.
