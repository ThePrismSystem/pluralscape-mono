---
# types-0pz6
title: Refresh ADR-023 with types-as-SoT convention
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:55:18Z
updated_at: 2026-04-22T22:12:21Z
parent: types-ltel
---

Update ADR-023 (Zod-Type Alignment) to document the definitive single-source-of-truth decision and the <Entity> / <Entity>ServerMetadata naming convention.

## Context

ADR-023 currently covers Zod-type alignment at a tactical level. The 2026-04-21 design decision elevates packages/types to explicit SoT status with downstream layers deriving-or-asserting-equal. This ADR refresh captures the why (encrypted-blob split means Drizzle cannot be SoT) and the enforcement mechanism (three parity gates, single CI check).

## Scope

- [ ] Read current ADR-023
- [ ] Add Status: Accepted section marking this as a refresh (or Supersedes if appropriate — pairs with the ADR-template supersession-fields task in the quick-wins epic)
- [ ] Document the naming convention: <Entity> (full decrypted shape) + <Entity>ServerMetadata (server-visible slice + encryptedData: Uint8Array)
- [ ] Document why Drizzle cannot be SoT (encrypted field names invisible to DB layer)
- [ ] Document the three parity gates: Drizzle-to-types structural equality, Zod-to-types z.infer equality, OpenAPI-to-types structural check
- [ ] Reference the CI job pnpm types:check-sot (sibling task) as the enforcement vector
- [ ] Cross-link to ADR-006 (encryption boundary) and ADR-018 (encryption-at-rest boundary)

## Out of scope

- Actual implementation of parity tests (sibling tasks)
- Publishing new entity-type pairs (sibling task)

## Acceptance

- docs/adr/023-\*.md updated with the above sections
- pnpm format:fix + pnpm lint pass
- Cross-links resolve to existing ADRs

## Notes

Pairs with the quick-wins bean that adds Supersedes/Superseded-by template fields; if that lands first, this refresh can use the new fields directly.

## Summary of Changes

- ADR-023 refreshed with the types-as-SoT triple convention: `<Entity>`, `<Entity>ServerMetadata`, `<Entity>Wire`
- Documented three parity gates (Drizzle / Zod / OpenAPI) and the `pnpm types:check-sot` enforcement vector
- `OptionalEqual` resolution deferred to pilot PR (task 16 updates the ADR once pilot lands)
