---
# db-drq1
title: Lift brands into shared Drizzle column helpers (timestamps/versioned/archivable)
status: todo
type: task
priority: normal
created_at: 2026-04-22T22:41:09Z
updated_at: 2026-04-22T22:41:13Z
parent: types-ltel
---

Drizzle parity tests currently strip brands via StripBrands<T> wrapper because shared helpers (timestamps(), versioned(), archivable()) return unbranded string/number columns. Fully branding them would cascade ~37 fixture-site updates across integration tests. Follow-up to the Phase 1 pilot (types-ltel): brand the helpers and update fixtures. When complete, remove the StripBrands wrapper from packages/db/src/**tests**/type-parity/\*.type.test.ts so brand-type drift is also caught.
