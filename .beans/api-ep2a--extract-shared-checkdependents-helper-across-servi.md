---
# api-ep2a
title: Extract shared checkDependents helper across services
status: todo
type: task
priority: normal
created_at: 2026-04-21T21:55:38Z
updated_at: 2026-04-21T21:55:38Z
parent: api-6l1q
---

## Context

During api-6l1q PR 1 refactor, multiple services duplicate the HAS_DEPENDENTS cascade pattern: query multiple FK count tables in parallel, aggregate non-zero counts into a `dependents` array, throw HTTP 409 HAS_DEPENDENTS if any exist.

Known instances:

- apps/api/src/services/member/lifecycle.ts:144-302 (`deleteMember`, 11 FK tables) — the reason lifecycle.ts is 302 LOC (slightly over the 300 target)
- apps/api/src/services/field-definition/delete.ts (ex field-definition.service.ts:506-582, `deleteFieldDefinition`, 3 FK tables + Promise.resolve stubs)
- Likely others — sweep needed

## Scope

- [ ] Audit all `delete` verb files in services/ for HAS_DEPENDENTS cascade patterns
- [ ] Design a shared helper signature: `checkDependents(tx, [{ table, predicate, typeName }...]) => Promise<Array<{type, count}>>`
- [ ] Extract helper into apps/api/src/lib/ or services/\_shared/
- [ ] Migrate known consumers (deleteMember, deleteFieldDefinition, etc.)
- [ ] Verify post-migration LOC of member/lifecycle.ts (should drop under 300)
- [ ] Add unit tests for the helper

## Acceptance

- All services with HAS_DEPENDENTS patterns use the helper
- No duplicated parallel-count + enumeration blocks remain in service files
- Typecheck + integration tests pass
- member/lifecycle.ts ≤300 LOC post-migration
