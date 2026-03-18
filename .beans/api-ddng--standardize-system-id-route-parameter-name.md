---
# api-ddng
title: Standardize system ID route parameter name
status: todo
type: task
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Some sub-routes use /:id (groups, subsystems, layers) while others use /:systemId (members, fields, innerworld, blobs). Handlers use fragile c.req.param('id') ?? '' vs unsafe 'as string' cast. Standardize all to /:systemId with requireParam(). Ref: audit P-3.
