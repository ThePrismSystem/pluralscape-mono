---
# db-drq1
title: Lift brands into shared Drizzle column helpers (timestamps/versioned/archivable)
status: completed
type: task
priority: normal
created_at: 2026-04-22T22:41:09Z
updated_at: 2026-04-23T12:00:48Z
parent: types-ltel
---

Drizzle parity tests currently strip brands via StripBrands<T> wrapper because shared helpers (timestamps(), versioned(), archivable()) return unbranded string/number columns. Fully branding them would cascade ~37 fixture-site updates across integration tests. Follow-up to the Phase 1 pilot (types-ltel): brand the helpers and update fixtures. When complete, remove the StripBrands wrapper from packages/db/src/**tests**/type-parity/\*.type.test.ts so brand-type drift is also caught.

## Summary of Changes

Primitives-only scope (revised from original all-30-tables plan).

**Landed:**

- `AnyBrandedId` union in `packages/types/src/ids.ts` (commit `8f222457`).
- `brandedId<B>()` helper in `packages/db/src/columns/pg.ts` + `sqlite.ts` (commit `d89f91e6`). Generic constrained to `AnyBrandedId`.

**Deferred to Plan 2 fleet (per-entity):**

- Table conversions (each entity's Drizzle table converts in its fleet PR alongside validation + parity + OpenAPI wiring).
- Timestamp customType brand lift (`pgTimestamp` / `sqliteTimestamp`) — defers ~1700 fixture wraps; fleet entity PRs wrap their own fixtures, or a dedicated cleanup PR flips the generics once all fleet entities land.
- `StripBrands<>` removal from parity tests — happens per-entity as each converts.

**Fleet ordering recommendation:**

1. `systems` (FK ancestor).
2. `accounts` (FK ancestor).
3. Leaves in any order.

**Why the narrow scope:**

- Full-scope (30 tables) attempt: ~281 files changed, 500+ typecheck errors, codemod contamination. Reverted.
- Four-table pilot: 100+ files because `systems`/`accounts` are FK ancestors. Reverted.
- Primitives-only: 2 files, green tree, fleet-ready.
