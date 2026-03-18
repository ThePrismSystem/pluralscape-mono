---
# api-iqmr
title: Batch N+1 queries in archiveRegion and duplicateMember
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:38Z
parent: api-i2pw
---

archiveRegion does individual UPDATE per region/entity instead of batch inArray(). duplicateMember does individual INSERT per photo/field value instead of batch .values([]). Ref: audit P-5, P-6.

## Summary of Changes

- Replaced region archive loop with batch `inArray` UPDATE in `innerworld-region.service.ts`
- Replaced entity archive loop with batch `inArray` UPDATE
- Replaced photo copy loop with batch `.values([...])` INSERT in `member.service.ts`
- Replaced field value copy loop with batch `.values([...])` INSERT
