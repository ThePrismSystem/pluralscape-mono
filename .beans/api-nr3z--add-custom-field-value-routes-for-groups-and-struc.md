---
# api-nr3z
title: Add custom field value routes for groups and structure entities
status: todo
type: feature
priority: critical
created_at: 2026-03-29T21:31:09Z
updated_at: 2026-03-29T21:31:13Z
parent: api-e7gt
blocked_by:
  - api-bae0
---

Field values only have REST routes for members (/:memberId/fields). The DB schema supports polymorphic ownership (groupId, structureEntityId columns exist), but no routes or service functions exist for groups or structure entities. The setFieldValue service only accepts MemberId — needs service-layer changes plus new routes.

Depends on: structure entity REST routes (api-bae0) for the structure entity portion.

Audit ref: Domain 4 gaps 1-2, Domain 7 gaps 1-3
