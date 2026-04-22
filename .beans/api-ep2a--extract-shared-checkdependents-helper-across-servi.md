---
# api-ep2a
title: Extract shared checkDependents helper across services
status: completed
type: task
priority: normal
created_at: 2026-04-21T21:55:38Z
updated_at: 2026-04-22T07:01:00Z
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

## Summary of Changes

Migrated 13 of 14 manual HAS_DEPENDENTS consumers to the shared checkDependents helper (apps/api/src/lib/check-dependents.ts, Task group 1, commit 227e1bb1). The helper signature was adjusted to accept `SQL | undefined` predicates so callers can pass `and(...)` without non-null assertions (consistent with drizzle `.where()` semantics).

Migrated:

- services/member/lifecycle.ts (11 checks) — 302 -> 259 LOC
- services/field-definition/delete.ts (3 checks + force cascade; hasType() helper replaces count variables)
- services/structure/entity-crud/lifecycle.ts (4 checks)
- services/structure/entity-type/delete.ts (1 check, narrative message with structured details preserved)
- services/system/archive.ts (1 HAS_DEPENDENTS check; the separate "only system" CONFLICT check kept as-is)
- services/timer-config/delete.ts (1 check, narrative-only)
- services/poll/delete.ts (1 check, helper function)
- services/innerworld/region/lifecycle.ts (2 checks, narrative-only combined message)
- services/channel/delete.ts (2 checks)
- services/custom-front/delete.ts (1 check, narrative-only)
- services/bucket/delete.ts (5 checks — replaced raw SQL UNION ALL with drizzle helper)
- services/webhook-config/lifecycle.ts (1 check, narrative-only)
- services/fronting-session/lifecycle.ts (1 check, narrative-only)

Skipped: services/innerworld/entity/lifecycle.ts — this file has NO HAS_DEPENDENTS check (listed by accident in the plan).

Hierarchy factory (hierarchy-service-factory.ts): now delegates to the new helper at the call site, translating its narrow DependentCheck shape (entityColumn/systemColumn/filterArchived) to predicate form. The factory preserves its narrative error format ("<entity> has 3 foo and 2 bar. Remove all dependents before deleting.") with no structured details payload. Net factory change: +23 LOC at the call site, offset by -58 LOC in hierarchy-service-helpers.ts (old narrow helper removed; only mapBaseFields remains).

Updated the one test that mocked the old helper (hierarchy-service-factory.test.ts) to mock the new location and new signature.

Verification: pnpm turbo typecheck (api): PASS. pnpm lint (api, --max-warnings 0): PASS. pnpm vitest run --project api: 5331/5331 PASS. pnpm vitest run --project api-integration: 1248/1248 PASS. All throw message text and typeName values preserved verbatim (public API contract).
