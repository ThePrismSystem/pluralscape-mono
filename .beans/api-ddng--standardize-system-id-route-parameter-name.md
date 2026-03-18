---
# api-ddng
title: Standardize system ID route parameter name
status: completed
type: task
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T08:01:34Z
parent: api-i2pw
---

Some sub-routes use /:id (groups, subsystems, layers) while others use /:systemId (members, fields, innerworld, blobs). Handlers use fragile c.req.param('id') ?? '' vs unsafe 'as string' cast. Standardize all to /:systemId with requireParam(). Ref: audit P-3.

## Summary of Changes\n\nChanged all 12 `/:id/` sub-resource mounts to `/:systemId/` in routes/systems/index.ts. Updated 112 route handlers across all sub-resource directories to use `parseIdParam(requireParam(c.req.param("systemId"), "systemId"), ID_PREFIXES.system)`. Replaced `as string` casts with `requireParam()` in innerworld/blobs/fields/members routes. System-level CRUD routes and auth routes unchanged.
