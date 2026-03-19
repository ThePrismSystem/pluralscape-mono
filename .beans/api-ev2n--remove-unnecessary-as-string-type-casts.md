---
# api-ev2n
title: Remove unnecessary as-string type casts
status: todo
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M18: Audit and remove unnecessary 'as string' type assertions where the type can be narrowed properly.

## Acceptance Criteria

- All unnecessary `as string` casts identified via codebase grep
- Each cast replaced with proper type narrowing (typeof check, Zod parse, or schema inference)
- No new `as string` introduced
- TypeScript strict mode passes without the removed casts
- No runtime behavior change (pure type-level refactor)
