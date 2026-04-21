---
# ps-cd6x
title: "Milestone 9a: Closeout Hardening"
status: in-progress
type: milestone
created_at: 2026-04-21T13:54:01Z
updated_at: 2026-04-21T13:54:01Z
---

Post-M9 closeout of structural debt and audit-gap items not covered by the per-package 2026-04-20 remediation epics (crypto-cpir, api-v8zu, db-bry7, mobile-e3l7, sync-me6c). The 2026-04-20 audit's three CRITICAL findings are verified fixed; what remains is MEDIUM/LOW severity structural work that the per-package remediation deliberately scoped out.

Specification: docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md

## In scope

- API service layer god-file refactor (15 files over 500 LOC → services/<domain>/<verb>.ts, each ≤300 LOC)
- packages/types as single source of truth for domain entity types (Drizzle, Zod, OpenAPI derive-or-assert-equal)
- Test file maintainability (split the 3 worst, umbrella for the remaining 16)
- Closeout hygiene (typed Hono context, RLS-wrapper lint rule, mobile test factories, queue-mock typing, ADR supersession fields, dev-only constants module, service-file LOC cap)
- Branded-ID drift cleanup across the 5 surfaces flagged by the 2026-04-20 audit pattern list

## Out of scope (deferred to named milestones)

- audit_log retention/drop job → M15 Polish and Launch (ps-9u4w)
- Versioned PARTITION BY migration → M15 (ps-9u4w)
- Mobile import-sp bundle-impact measurement → M12 Data Interpolation (ps-8coo)

## Blocks / blocked-by

- blocked-by: ps-h2gl (M9 Data Import) — logical ordering; M9 already completed
- blocks: ps-9cca (M10 UI/UX Design) — ps-9cca blocked-by will be updated to include this milestone

## Completion criteria

All direct and transitive child beans completed. Drift-regression gates in CI: types-SoT parity checks green, service-file LOC cap enforced, RLS-wrapper lint rule enforced.
