---
# api-f5re
title: "Audit: refactoring opportunities"
status: completed
type: task
priority: normal
created_at: 2026-03-30T21:11:23Z
updated_at: 2026-03-31T01:44:57Z
parent: api-e7gt
---

Identify code that would benefit from refactoring: duplicated logic, poor cohesion, misplaced responsibilities, and structural improvements for maintainability.

## Summary of Changes

Audit assessed refactoring opportunities:

- Route handler boilerplate is idiomatic Hono — each handler is ~27 lines, self-contained. Abstracting would add indirection without benefit.
- Service archive/restore functions share a structural pattern but those that don't delegate to the shared archiveEntity/restoreEntity helpers in lib/entity-lifecycle.ts have legitimate domain-specific reasons: fronting-comment requires an extra frontingSessionId WHERE condition, member.archive cascades to photos (restore intentionally does not cascade), member-photo requires an extra memberId WHERE condition, and innerworld-region performs a recursive descendant cascade to regions and entities.
- The hierarchy-service-factory.ts is well-scoped: used for structure entities with consistent CRUD semantics. Not over-engineered.
- No refactoring warranted — domain logic differences justify the per-service implementations.
