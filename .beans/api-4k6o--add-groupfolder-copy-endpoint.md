---
# api-4k6o
title: Add group/folder copy endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T08:12:39Z
parent: api-i2pw
---

Groups have move but no copy/duplicate route. Add POST /systems/:systemId/groups/:groupId/copy. Ref: audit F-3.

## Summary of Changes\n\nAdded CopyGroupBodySchema, copyGroup service function (shallow copy with optional membership copy), POST /:groupId/copy route, and route tests.
