---
# types-1spw
title: Anchor G4 parity assertions to data transform return types
status: todo
type: task
priority: normal
created_at: 2026-04-25T09:05:46Z
updated_at: 2026-04-25T09:05:51Z
parent: ps-y4tb
---

## Background

Task 3.7 of ps-y4tb (Encrypted-entity SoT consolidation, Member pilot) discovered a circular dependency that prevents the planned G4 (Body Zod ↔ Transform output) parity from being mechanically anchored to the actual transform return types in `packages/validation` parity tests.

`@pluralscape/data` depends on `@pluralscape/validation`, so importing `encryptMemberInput` / `encryptMemberUpdate` from `@pluralscape/data/transforms/member` into `packages/validation/src/__tests__/type-parity/member.type.test.ts` would create a workspace cycle. Both 3.7 and the existing `packages/validation/src/__tests__/contract-member.test.ts` therefore inline the structural shape (`{ encryptedData: string }`, `{ encryptedData: string; version: number }`, `{ encryptedData: string; copyPhotos: boolean; copyFields: boolean; copyMemberships: boolean }`) instead of `ReturnType<typeof encryptMemberInput>`.

## Drift risk

If a transform return signature changes (e.g. adds a `meta: string` field), the inline shape in the parity test will not auto-update — the test passes silently while the wire breaks.

## Options

A. **Move the G4 parity tests into `packages/data`.** Data already imports both validation and types, so `ReturnType<typeof encryptXInput>` and `z.infer<typeof CreateXBodySchema>` can sit in the same file. Per-entity test files mirror the structure currently in `packages/validation/src/__tests__/type-parity/`. (Recommended.)

B. **Introduce a `packages/parity-tests` (or similar) test-only workspace that depends on both.** Heavier; only worth it if multiple cross-package parity gates need a home.

C. **Invert the data ↔ validation dependency** so validation depends on data instead. Likely impractical — schemas drive transform input shapes, not the other way around.

## Scope

Apply to the full encrypted-entity fleet *after* PR 2 of ps-y4tb lands the inline-shape pattern uniformly. Doing this per-entity during the fleet migration would amplify the per-PR diff for marginal benefit; a single follow-up sweep is cleaner.

## Acceptance

- [ ] G4 parity assertions for each in-scope encrypted entity live in a file that imports both the Zod schema and the transform return type as values, without breaking the dep graph
- [ ] The inline-shape G4 assertions in `packages/validation/src/__tests__/type-parity/<entity>.type.test.ts` and `packages/validation/src/__tests__/contract-<entity>.test.ts` are removed (or kept as belt-and-suspenders, decided per-entity)
- [ ] `pnpm types:check-sot` passes
- [ ] CI typecheck/lint clean

## Cross-references

- Parent: ps-y4tb (Encrypted-entity type SoT consolidation)
- Related: ADR-023 (Zod ↔ types alignment)
- Plan reference: `docs/superpowers/plans/2026-04-25-ps-y4tb-encrypted-entity-sot-consolidation.md` Task 3.7 (cycle constraint note)
