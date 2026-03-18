---
# api-iqmr
title: Batch N+1 queries in archiveRegion and duplicateMember
status: todo
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

archiveRegion does individual UPDATE per region/entity instead of batch inArray(). duplicateMember does individual INSERT per photo/field value instead of batch .values([]). Ref: audit P-5, P-6.
