---
# ps-sg0u
title: Add Supersedes/Superseded-by fields to ADR template + backfill
status: todo
type: task
priority: low
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T13:59:06Z
parent: ps-0vwf
---

Add Supersedes: and Superseded-by: fields to docs/adr/000-template.md and backfill the obvious chains. ADRs currently accumulate without deprecation markers — 37 ADRs after two years.

## Context

Multiple ADRs build on or replace earlier decisions without explicit markers (e.g. ADR-037 "Argon2id context-specific profiles" replaces the unified PWHASH\_\*\_UNIFIED constants implicit in ADR-006; ADR-029 "server-side encrypted email" relates to ADR-028 "opt-in IP audit logging"). Future readers have no way to see which decisions are still live vs. superseded.

## Scope

- [ ] Update docs/adr/000-template.md: add Status line options (Accepted / Superseded / Deprecated) and two new optional fields — Supersedes: <ADR-###> and Superseded-by: <ADR-###>
- [ ] Backfill at least ADR-037 (supersedes the unified Argon2 profile; reference the implicit decision in ADR-006)
- [ ] Scan the ADR list for other obvious chains and backfill — prioritize ADR-023 (Zod-type alignment) which this milestone's types-SoT epic refreshes
- [ ] Document the convention in docs/architecture.md or the ADR README if one exists

## Out of scope

- Writing new ADRs
- Deep archaeology on old ADRs — only backfill clear chains

## Acceptance

- docs/adr/000-template.md has the new fields
- At least 3 existing ADRs have the fields filled in
- pnpm format:fix + pnpm lint pass

## Priority

Low — documentation hygiene, no functional impact.
