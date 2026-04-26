---
# ps-etbc
title: "ps-y4tb fleet completion: data transforms, services, routes, tRPC, parity tests, manifest"
status: in-progress
type: task
priority: high
created_at: 2026-04-25T19:49:40Z
updated_at: 2026-04-25T23:59:04Z
parent: ps-y4tb
---

## Background

PR 2 of ps-y4tb (#561, encrypted-entity SoT consolidation, fleet rollout) landed the canonical type chain in `@pluralscape/types` for 28 of the 29 in-scope encrypted entities (17 Class A, 10 Class B, friend-connection). CheckInRecord is tracked separately in `types-600s`.

This bean covers the remaining fleet rollout work — the data-package transforms, the SoT manifest, the OpenAPI parity surface, and the documentation refresh.

## Design principle (REVISED 2026-04-25)

**Pre-production = no aliases, no re-exports, no shims, no half-measures.** The previous version of this bean prescribed `XRaw = XWire` aliases and `export type { XEncryptedInput };` re-exports "to preserve the data-package's external API and minimize PR scope." That is the wrong design — it perpetuates exactly the kind of indirection the pre-production policy forbids. The cleanest end-state is:

- `decryptX(raw: XWire, masterKey)` — consumes the canonical wire type directly. No `XRaw` alias.
- `encryptXInput(input: XEncryptedInput, masterKey)` — consumes the canonical input type directly, imported from `@pluralscape/types`. No re-export.
- The transform file declares zero types of its own. It only declares functions.
- All consumers (mobile hooks, mobile persisters, mobile row-transforms, anywhere else) update their imports to pull `XWire` and `XEncryptedInput` from `@pluralscape/types` directly. The data package owns the transform functions; the types package owns the types.

This is more work than the original plan (touches ~47 consumer files in `apps/mobile/`). That work has to happen eventually. Doing it now eliminates the indirection forever and matches the Member-pilot direction more honestly than even Member itself currently does (Member still has `MemberRaw = MemberWire;` and `export type { MemberEncryptedInput };` left over — both are dead weight to be removed as part of this work).

## In scope

### A. Data transforms — strip indirection

For each file in `packages/data/src/transforms/` (25 files), delete EVERY type the transform declares and rewrite the functions to consume canonical types directly.

**Per-file deletions:**

1. `export type XRaw = ...` (24 of 25 transforms have this; member.ts has the alias form, the rest hand-roll `Omit<XDecrypted, XEncryptedFields> & { encryptedData: string; archived: boolean; archivedAt: UnixMillis | null }`). DELETE.
2. `export interface XEncryptedFields { ... }` (11 transforms have this). DELETE — the canonical `XEncryptedInput = Pick<X, XEncryptedFields-from-types>` from `@pluralscape/types` supersedes it.
3. `export type AssertXFieldsSubset = ... extends ... ? true : never;` (11 transforms). DELETE — the canonical `Pick<>` derivation makes the subset relationship a structural identity, not a guarded assertion.
4. `function assertXEncryptedFields(raw: unknown): asserts raw is XEncryptedFields` (10 transforms have this — chains of `assertObjectBlob` + `assertStringField`). DELETE — replace with `XEncryptedInputSchema.parse(decrypted)` from `@pluralscape/validation` (Member-pilot pattern at `transforms/member.ts:43`).
5. `export type { XEncryptedInput };` re-exports (currently only in `member.ts:16`, but this is the pattern the original bean prescribed for every transform — do not introduce). DELETE the existing one in member.ts.
6. `export type XPage` and `decryptXPage` — KEEP. These are real local types that compose `XWire[]` with cursor metadata; they are not aliases.

**Per-file rewrites:**

1. `decryptX(raw: XWire, masterKey)` — re-brand IDs/timestamps via `brandId<XId>(raw.id)` / `toUnixMillis(raw.createdAt)` per Member pilot. Use `XEncryptedInputSchema.parse(decrypted)` from `@pluralscape/validation` to validate plaintext.
2. `encryptXInput(input: XEncryptedInput, masterKey)` — input type imported from `@pluralscape/types`.
3. `encryptXUpdate(input: XEncryptedInput, version: number, masterKey)` — same.

**Files (25):** `acknowledgement`, `board-message`, `channel`, `custom-field` (FieldDefinition + FieldValue), `custom-front`, `device-token`, `friend-code`, `friend-connection`, `friend-dashboard`, `fronting-comment`, `fronting-report`, `fronting-session`, `group`, `innerworld-canvas`, `innerworld-entity`, `innerworld-region`, `lifecycle-event`, `member` (cleanup leftover alias + re-export), `message`, `note`, `notification-config`, `poll` (Poll + PollVote), `privacy-bucket`, `relationship`, `snapshot`, `structure-entity`, `structure-entity-type`, `system-settings`, `timer-check-in` (TimerConfig only — CheckInRecord deferred to types-600s).

**A prior subagent attempt on this work went rogue, edited test files outside scope, and broke signatures.** Approach this in smaller batches with strict scope (explicitly forbid test-file edits — those are Section C). Verify each batch with typecheck before continuing.

### B. Consumer migration (in same PR as A)

Every consumer of `@pluralscape/data` that imports `XRaw` / `XEncryptedFields` / `XEncryptedInput` (re-exported) updates its imports to pull from `@pluralscape/types` directly. The `decryptX` / `encryptXInput` / `encryptXUpdate` function imports stay on `@pluralscape/data`.

**Affected consumers (47 files):**

- `apps/mobile/src/hooks/use-*.ts` (~24 hooks, one per entity)
- `apps/mobile/src/features/import-sp/persister/*.persister.ts` and `persister-helpers.ts`
- `apps/mobile/src/data/row-transforms/*.ts` (4 files: fronting, lifecycle, communication, identity)
- Any other `@pluralscape/data` importer surfaced by `grep -rln "from \"@pluralscape/data" --include="*.ts" apps/ packages/`

For each: replace `import type { XRaw, XEncryptedInput } from "@pluralscape/data/transforms/x"` → `import type { XWire, XEncryptedInput } from "@pluralscape/types"`. Replace local references to `XRaw` with `XWire`. Function imports stay on `@pluralscape/data`.

### C. Parity tests (deferred to types-1spw)

Originally Section C of this bean. Subsumed by `types-1spw` (canonical, import-anchored G4 in the data package) once Section A lands. Do not add net-new inline-shape G4 assertions in `packages/validation/src/__tests__/type-parity/`.

### D. SoT manifest

For each of the 29 in-scope entities (Class A, B, D), extend the manifest entry in `packages/types/src/__sot-manifest__.ts` with `encryptedInput` and `result` slots. Add corresponding assertions in `packages/types/src/__tests__/sot-manifest.test.ts`. No aliases — the manifest references canonical type names directly.

### E. OpenAPI parity

For each of the 29 in-scope entities, replace the carve-out form (`Omit<…, "encryptedData"> + opaque-string check`) in `scripts/openapi-wire-parity.type-test.ts` with the G7 full-equality form: `Equal<XResponseOpenApi, XWire>`. Update `Equal<XWire, Serialize<X>>` self-consistency assertions to `Equal<XWire, Serialize<XResult>>`.

### F. Documentation refresh

Update `CLAUDE.md`, `packages/types/README.md`, `packages/data/README.md`, ADR-023 (or the canonical-chain ADR if `types-kk7a` decides to commit a new one), `docs/architecture.md`, `CONTRIBUTING.md` to reflect the canonical chain + drift gates and to document that the data package owns transform FUNCTIONS only (no types).

## Scope reality

- **Data transforms:** 25 files, ~10-15 LOC deleted per file = ~300 LOC delta in the data package (pure deletion).
- **Consumer migration:** 47 files in `apps/mobile/`, ~1-3 import lines changed per file. Mostly mechanical sed-style edits; type-check catches misses.
- **SoT manifest:** 29 entities × 2 slots + matching test assertions.
- **OpenAPI parity:** 29 entities × 2-line edits.
- **Docs:** ~6 files.

This is a large PR. It has to be a large PR because the design principle is "no shims." Breaking it into multiple PRs would re-introduce the indirection problem in the intermediate state.

If genuinely too large to review as one PR, split by **entity-class boundary** (A entities first, then B + D), not by **layer boundary** (transforms-then-consumers), since the layer split would leave consumers broken between PRs.

## Out of scope

- CheckInRecord canonical chain — see `types-600s`
- Class C entities (api-key, session, system-snapshot) — see `ps-qmyt`
- Class E webhook-delivery server-side encryption — see `ps-f3ox`
- Plaintext / special entity SoT — see `ps-6phh`

## Acceptance

- [ ] All `decryptX` functions in `packages/data/src/transforms/` consume `XWire` (not `XRaw`) and re-brand IDs/timestamps
- [ ] All `encryptXInput` / `encryptXUpdate` consume `XEncryptedInput` from `@pluralscape/types` (no local declaration, no re-export)
- [ ] Zero `XRaw` exports remain in `packages/data/src/transforms/`
- [ ] Zero local `XEncryptedFields` interfaces remain in `packages/data/src/transforms/`
- [ ] Zero `AssertXFieldsSubset` types remain in `packages/data/src/transforms/`
- [ ] Zero `assertXEncryptedFields` runtime validators remain (replaced by Zod schema parse)
- [ ] Zero `export type { ... }` re-exports remain in `packages/data/src/transforms/` (specifically the leftover one in member.ts)
- [ ] All 47 consumers in `apps/mobile/` import canonical types from `@pluralscape/types` (verified by `grep -rn "XRaw\|XEncryptedFields" --include="*.ts" apps/` returning zero hits for transform-derived types)
- [ ] SoT manifest extended with `encryptedInput` and `result` slots for 29 entities; manifest test passes
- [ ] OpenAPI parity in G7 form for all 29 entities
- [ ] `pnpm types:check-sot` clean
- [ ] CI green (unit / integration / E2E)
- [ ] Documentation refreshed

## Cross-references

- Parent: ps-y4tb
- Sibling: types-600s (CheckInRecord), types-1spw (G4 anchor in data; can land after A completes)
- Plan: `docs/superpowers/plans/2026-04-25-ps-y4tb-encrypted-entity-sot-consolidation.md` Tasks 4.4–4.11 + Task 5

## Update — scope philosophy (2026-04-25)

The original bean preserved `XRaw = XWire` aliases and `export type { XEncryptedInput };` re-exports "to preserve the data-package's external API and minimize PR scope." Upon review, this was exactly the kind of indirection the pre-production policy forbids — same anti-pattern as `@deprecated` shims removed in PR #561. Bean rewritten to delete all transform-package types and migrate consumers in the same scope. See feedback memory `feedback_no_scope_minimization.md` for the principle.
