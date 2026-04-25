---
# ps-y4tb
title: Encrypted-entity type SoT consolidation
status: in-progress
type: epic
priority: normal
created_at: 2026-04-25T07:48:01Z
updated_at: 2026-04-25T09:34:38Z
parent: ps-cd6x
---

Consolidate the entity type chain so that @pluralscape/types is the single source of truth, eliminating hand-rolled drift surfaces across packages/data, apps/api/services, and packages/types itself.

## Scope: ENCRYPTED ENTITIES ONLY (34 entities)

This bean covers the 34 entities with encrypted data. Plaintext consolidation is tracked separately in a sibling bean. Per the 2026-04-25 audit:

- Class A (canonical pattern, 18 entities): bucket, custom-front, field-definition, field-value, fronting-comment, fronting-session, group, innerworld-canvas, innerworld-entity, innerworld-region, lifecycle-event, member, member-photo, relationship, structure-entity, structure-entity-type, system, system-settings
- Class B (EncryptedFields not yet exported, 10 entities): acknowledgement, board-message, channel, journal-entry, message, note, poll, poll-vote, timer-config, wiki-page
- Class C (structurally divergent encryption, 3 entities): api-key, session, system-snapshot
- Class D (optional/nullable encryption, 2 entities): check-in-record, friend-connection
- Class E (server-side T3 encryption, 1 entity): webhook-delivery

## Background

The 2026-04-25 type-drift audit revealed structural gaps in the existing type chain (using Member as the reference case):

1. `MemberWire = Serialize<Member>` describes a fictional wire shape that never crosses HTTP. The actual canonical wire-response type is `Serialize<MemberServerMetadata>` (asserted in `scripts/openapi-wire-parity.type-test.ts:178`). Two definitions disagree.
2. `MemberRaw` in `packages/data/src/transforms/member.ts:11` is hand-rolled; should be derived from `MemberServerMetadata` via canonical aliases in @pluralscape/types.
3. `MemberEncryptedInput` in `packages/data/src/transforms/member.ts:28` is a derivation that should live in @pluralscape/types.
4. `MemberResult` in `apps/api/src/services/member/internal.ts:13` is an EncryptedWire projection; should be re-exported from @pluralscape/types so all entities have a discoverable canonical name.
5. `toMemberResult` (services internal.ts:15-24) hand-rolls the row arg type instead of importing `MemberRow` from @pluralscape/db.
6. `CreateMemberBody`, `UpdateMemberBody`, `DuplicateMemberBody` (interfaces in @pluralscape/types) are redundant duplicates of `z.infer<typeof XBodySchema>` from the validation package.
7. Service signatures use `params: unknown` then revalidate via `safeParse` — double validation; tRPC routers manually rebuild objects to feed the unknown-typed services.

## Outcome

@pluralscape/types defines the canonical chain per entity: `X` → `XEncryptedFields` → `XEncryptedInput` → `XServerMetadata` → `XResult` → `XWire`. Other packages derive from those. Validation lives at the boundary (REST route + tRPC); services accept typed input and trust it.

## Spec

To be written via brainstorming skill (2026-04-25).



## PR 1 Pilot Progress (2026-04-25)

Member canonical chain implemented in worktree `refactor/ps-y4tb-pilot-member`. All 10 PR-1 tasks complete:

- [x] Tasks 3.1–3.6: Member entity types, data transforms, services, routes, tRPC, service test cleanup
- [x] Task 3.7: Validation parity tests (G3 + G4 inline-shape form, cycle constraint discovered)
- [x] Task 3.8: SoT manifest + manifest test extended with encryptedInput + result slots
- [x] Task 3.9: OpenAPI parity converted from carve-out split to G7 full-equality (`MemberResponseOpenApi ≡ MemberWire`)
- [x] Task 3.10: integration tests + 7-commit push + PR #560 opened

Cycle constraint discovered: `@pluralscape/data` already depends on `@pluralscape/validation`, so G4 in validation parity tests cannot import from data. Inline-shape G4 used instead (mirrors existing pattern in `packages/validation/src/__tests__/contract-member.test.ts`). Follow-up bean **types-1spw** tracks moving canonical G4 anchoring to the data package after fleet rollout.

Plan reference: `docs/superpowers/plans/2026-04-25-ps-y4tb-encrypted-entity-sot-consolidation.md` Task 3.7 (cycle-constraint note above Step 1).



## PR 1 Merged — 2026-04-25 09:33 UTC

PR #560 squash-merged as commit `e32d3a97` on main. All 13 CI checks passed (typecheck, lint, unit coverage, integration, e2e, migration freshness, OpenAPI reconciliation, tRPC parity, scope coverage, security audit, semgrep, CodeQL).

### Member canonical chain (live on main)

```
Member → MemberEncryptedFields → MemberEncryptedInput
      → MemberServerMetadata → MemberResult → MemberWire
```

### Pattern locked in for fleet rollout

- New canonical types in `@pluralscape/types`: `MemberEncryptedInput = Pick<Member, MemberEncryptedFields>`, `MemberResult = EncryptedWire<MemberServerMetadata>`, `MemberWire = Serialize<MemberResult>`
- `Serialize<T>` extended in `packages/types/src/type-assertions.ts` to also strip `__encBase64` brand
- `*Body` interfaces dropped — Zod owns body shapes
- Services: `params: unknown` + `safeParse` removed; signatures take `z.infer<typeof XBodySchema>`
- Routes: validate at boundary with `safeParse` + `ApiHttpError(VALIDATION_ERROR)`
- tRPC: pass `input` directly (or destructure URL params)
- Manifest: `encryptedInput` and `result` slots added
- OpenAPI parity in G7 form (full equality `MemberResponseOpenApi ≡ MemberWire`, no carve-out)

### Next: PR 2 (Task 4 in plan) — fleet rollout to 29 entities

11 commits across Class A (18), Class B (10), Class D (2) per plan. Class C (api-key, session, system-snapshot) tracked separately in `ps-qmyt`. Class E (webhook-delivery) tracked in `ps-f3ox`. Plaintext entities tracked in `ps-6phh`.

Worktree to use: `/home/theprismsystem/git/ps-y4tb-fleet` from `origin/main` (post-merge).
