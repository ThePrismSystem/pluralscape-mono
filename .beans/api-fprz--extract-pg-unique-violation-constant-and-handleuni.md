---
# api-fprz
title: Extract PG_UNIQUE_VIOLATION constant and handleUniqueViolation helper
status: todo
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

PostgreSQL unique-violation code '23505' used as magic string in 8 locations across structure-membership, structure-link, group-membership, and auth services. Extract constant and shared catch helper. Ref: audit P-10, P-11.
