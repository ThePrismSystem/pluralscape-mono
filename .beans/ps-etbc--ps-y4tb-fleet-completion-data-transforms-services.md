---
# ps-etbc
title: "ps-y4tb fleet completion: data transforms, services, routes, tRPC, parity tests, manifest"
status: todo
type: task
priority: high
created_at: 2026-04-25T19:49:40Z
updated_at: 2026-04-25T22:27:49Z
parent: ps-y4tb
---

## Background

PR 2 of ps-y4tb (encrypted-entity SoT consolidation, fleet rollout) landed the canonical type chain in `@pluralscape/types` for 28 of the 29 in-scope encrypted entities (17 Class A, 10 Class B, friend-connection). CheckInRecord is tracked separately in `types-600s`.

This bean covers the remaining fleet rollout tasks deferred from PR 2 to keep its diff additive and reviewable:

## In scope

### A. Data transforms cleanup (Task 4.4 of original plan)

Per file in `packages/data/src/transforms/`: drop hand-rolled `XRaw = Omit<XDecrypted, XEncryptedFields> & { encryptedData: string }`, replace with `XRaw = XWire` from `@pluralscape/types`. Drop local `XEncryptedInput` declarations and re-export the canonical alias. Drop `AssertXFieldsSubset` types. Update `decryptX` to re-brand IDs/timestamps via `brandId<XId>(raw.id)` etc. (per Member-pilot pattern).

Files: acknowledgement, board-message, channel, custom-field (FieldDefinition + FieldValue), custom-front, friend-connection, fronting-comment, fronting-session, group, innerworld-canvas, innerworld-entity, innerworld-region, lifecycle-event, message, note, poll (Poll + PollVote), privacy-bucket, relationship, structure-entity, structure-entity-type, system-settings, timer-check-in (TimerConfig only — CheckInRecord deferred to types-600s).

A prior subagent attempt on this work went rogue, edited test files outside scope, and broke signatures (system-settings.ts, poll.ts encryptedData null handling, multiple test fixtures). Approach this in smaller batches with strict scope (explicitly forbid test file edits — those are Task 4.9). Verify each batch with typecheck before continuing.

### B. Service / route / tRPC migration (Tasks 4.5-4.8)

For each of the 14 services/routes/routers consuming the deprecated `*Body` interfaces (FieldDefinition ×2, FieldValue ×2, MemberPhoto ×1):

- Service create/update files: change signature from `params: unknown` + `safeParse` to `body: z.infer<typeof XBodySchema>`
- Route files: parse body at boundary with `XBodySchema.safeParse`, throw `ApiHttpError(VALIDATION_ERROR)` on failure
- tRPC routers: pass input directly (no manual rebuild)

Affected files (from grep on 2026-04-25):

- apps/api/src/services/member/photos/create.ts
- apps/api/src/services/field-definition/{create,update}.ts
- apps/api/src/services/field-value/{set,update}.ts
- apps/api/src/trpc/routers/{member-photo,field}.ts
- apps/api/src/routes/.../\* (all corresponding routes)
- packages/import-sp/src/mappers/field-definition.mapper.ts (uses CreateFieldDefinitionBody — switch to z.infer)
- packages/data/src/transforms/custom-field.ts

Note: FieldDefinition, FieldValue, and MemberPhoto are already migrated end-to-end in PR #561 (alongside the Member pilot from #560). Their Body interfaces have been deleted and consumers are no longer in this bean's scope.

### C. Parity tests (Task 4.9)

Add `packages/validation/src/__tests__/type-parity/<entity>.type.test.ts` for the 19 previously-uncovered entities, using the Member pilot G3 + G4 inline-shape pattern. Update existing 11 parity tests if their assertions reference any retired type.

### D. SoT manifest (Task 4.11)

For each of the 29 in-scope entities (Class A, B, D), extend the manifest entry in `packages/types/src/__sot-manifest__.ts` with `encryptedInput` and `result` slots. Add corresponding assertions in `packages/types/src/__tests__/sot-manifest.test.ts`.

### E. OpenAPI parity (Task 4.10)

For each of the 29 in-scope entities, replace the carve-out form (Omit<…, "encryptedData"> + opaque-string check) in `scripts/openapi-wire-parity.type-test.ts` with the G7 full-equality form: `Equal<XResponseOpenApi, XWire>`. Update `Equal<XWire, Serialize<X>>` self-consistency assertions to `Equal<XWire, Serialize<XResult>>`.

### F. Documentation refresh (Task 5)

Update CLAUDE.md, packages/types/README.md, packages/data/README.md, ADR-023, architecture.md, CONTRIBUTING.md to reflect the canonical chain + drift gates.

## Out of scope

- CheckInRecord canonical chain — see `types-600s`
- Class C entities (api-key, session, system-snapshot) — see `ps-qmyt`
- Class E webhook-delivery server-side encryption — see `ps-f3ox`
- Plaintext / special entity SoT — see `ps-6phh`

## Acceptance

- [ ] All `decryptX` functions in `packages/data/src/transforms/` consume `XWire` (the canonical wire type) and re-brand IDs/timestamps
- [ ] All `*Body` deprecated interfaces removed from `@pluralscape/types`
- [ ] All 14 consumers migrated to `z.infer<typeof XBodySchema>`
- [ ] Per-entity parity tests for 29 entities (G3 + G4 inline-shape form)
- [ ] SoT manifest extended; manifest test passes
- [ ] OpenAPI parity in G7 form for all 29 entities
- [ ] `pnpm types:check-sot` clean
- [ ] CI green (unit / integration / E2E)
- [ ] Documentation refreshed (Task 5)

## Cross-references

- Parent: ps-y4tb
- Sibling: types-600s (CheckInRecord), types-1spw (G4 anchor in data)
- Plan: `docs/superpowers/plans/2026-04-25-ps-y4tb-encrypted-entity-sot-consolidation.md` Tasks 4.4–4.11 + Task 5

## Update — out-of-scope clarification (2026-04-25)

Do not add net-new inline-shape G4 assertions in `packages/validation/src/__tests__/type-parity/`. Those will be superseded by `types-1spw` (canonical, import-anchored G4 in the data package) once the data-package transforms cleanup lands.

If existing inline-shape G4 assertions are found during ps-etbc work (e.g., from Member pilot or PR #561 migrations), leave them in place — `types-1spw` will sweep them later.
