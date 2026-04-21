---
# api-voa8
title: Replace Record<string, unknown> setClauses with drizzle $inferInsert in service update paths
status: todo
type: task
priority: low
created_at: 2026-04-21T21:55:51Z
updated_at: 2026-04-21T21:55:51Z
parent: api-6l1q
---

## Context

During api-6l1q PR 1 refactor, api-43vk surfaced that field-definition's `updateFieldDefinition` uses `setClause: Record<string, unknown>` — loses drizzle's type safety for SET columns. drizzle's `$Type<typeof <table>.$inferInsert>` would restore it.

Likely pattern exists in other update paths across services. A sweep would upgrade type safety across the codebase without behavior changes.

## Scope
- [ ] Grep: `Record<string, unknown>` in apps/api/src/services/**/update.ts (and any non-split services still using the pattern)
- [ ] For each, replace with `Partial<typeof <table>.$inferInsert>` or a narrower type
- [ ] Verify typecheck still passes; adjust call sites if narrowing reveals bugs
- [ ] No runtime changes expected

## Acceptance
- Zero `Record<string, unknown>` setClause patterns in services/
- All update paths use drizzle-inferred types
- Typecheck + unit + integration tests green
