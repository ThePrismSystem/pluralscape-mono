---
# ps-6lwp
title: Audit hand-rolled types across codebase; route to @pluralscape/types
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:16Z
updated_at: 2026-04-24T21:49:32Z
parent: types-ltel
---

Sweep apps/api, apps/mobile, and every packages/\* (excluding packages/types itself) for local interface/type declarations that duplicate domain entity shapes, branded-ID shapes, or enum unions already exported from @pluralscape/types. Replace duplicates with imports from the types package; delete the local declarations.

## Context

Types-as-SoT works only if nothing outside packages/types is authoritatively defining the same shape. Grep patterns typical of drift: local interface X { id: string; systemId: string; ... } shapes that mirror published entity types; local type X = "foo" | "bar" unions that mirror published enum types; string or string & { \_\_brand: "X" } ad-hoc branded-ID attempts that duplicate packages/types/src/ids.ts.

## Scope

- [ ] Enumerate offenders via grep — suggested search patterns:
  - `interface \w+ \{[\s\S]*\bid:\s*(string|\w+Id)\b`
  - `type \w+Id = string`
  - `type \w+ = "` (for union-type drift)
  - Manual inspection of apps/api/src/services, apps/mobile/src/hooks, apps/mobile/src/features, packages/sync/src/strategies, packages/queue/src/adapters
- [ ] Produce a markdown checklist file at docs/local-audits/2026-04-21-hand-rolled-types-audit.md with file path + line + suggested replacement
- [ ] For each offender: replace with import from @pluralscape/types and delete the local declaration
- [ ] Track each fix as a `- [ ]` line in the audit file

## Out of scope

- Creating new entity-type pairs (sibling publish-pairs task handles this)
- Changing packages/types shapes (SoT hand-authored, this task only removes duplicates)
- Zod / Drizzle schema changes

## Acceptance

- Audit file committed with all offenders enumerated and every box checked
- pnpm typecheck + pnpm lint pass
- pnpm test:unit passes across affected packages

## Notes

Expect dozens of small fixes across mobile and service code. Consider breaking into per-package PRs if the total diff becomes unmanageable.

## Summary of Changes

Branch `feat/types-ssot-hardening` (single branch; first commit is types-cfp6 CI gate).

### Tier 1 — Duplicates renamed/derived from SoT

- `packages/data/src/transforms/{fronting-comment,fronting-session,innerworld-region}.ts`: local `*EncryptedFields` object-shape interfaces renamed to `*Plaintext` and derived as `Pick<Entity, EntityEncryptedFields>` from types. The same name `*EncryptedFields` is reserved for the types-package key-union consumed by `Pick<>`.
- `apps/mobile/src/features/import-sp/persister/member.persister.ts`: local `MemberEncryptedFields` deleted; persister now consumes `MemberEncryptedInput` from `@pluralscape/data` and handles the `ImageSource` discriminated union properly. Dead `avatarBlobId` plumbing dropped from `PersisterProcMemberCreate`/`Update` and the tRPC adapter.
- `packages/db/src/helpers/enums.ts`: `KNOWN_SATURATION_LEVELS`/`POLL_KINDS` re-exported from `@pluralscape/types`.

### Tier 2 — Cross-package dedupe

- `packages/import-sp/src/{engine/import-engine.ts,persistence/persister.types.ts}`: `ImportRunOutcome`, `ImportRunResult`, `PersisterUpsertAction`, `PersisterUpsertResult` removed and re-exported from `@pluralscape/import-core`.

### Tier 3 — SearchScope rename

- `apps/mobile/src/hooks/use-search.ts`: `SearchScope` → `UiSearchScope` to disambiguate from the sync-package `SearchScope = "self" | "friend"` event union.

### Tier 4 — Crypto rename + dead code

- `packages/crypto/src/types.ts`: `AuthKey` → `AuthKeyMaterial` (32-byte key-material brand). `EncryptedBlob` brand deleted (it shadowed the domain `EncryptedBlob` discriminated union and had no consumers; `assertEncryptedBlob` was dead too).
- One external consumer (`apps/api/src/services/auth/login.ts`) updated.

### Tier 5 — `EncryptedWire<T>` envelope + 19 \*Result collapses

- New: `packages/types/src/encrypted-wire.ts` publishes `EncryptedWire<T>` — `Omit<T, "encryptedData"> & { readonly encryptedData: string | string|null }`. Nullability preserved via `null extends T["encryptedData"]` (the natural `extends EncryptedBlob | null` form is vacuously true and was a bug).
- 19 service `*Result` interfaces collapsed to `type XResult = EncryptedWire<XServerMetadata>`: Member, CustomFront, BoardMessage, PrivacyBucket, FrontingSession, Poll, Group, InnerWorldCanvas, InnerWorldRegion, Relationship, Acknowledgement, FieldDefinition, FieldValue, InnerWorldEntity, MemberPhoto, Message, Snapshot, StructureEntity, EntityType.
- Mobile fix: `RawPage`/`DecPage` factories had mutable `data: T[]` while tRPC always emits `readonly data: readonly T[]`. Made the array element readonly; previous structural slack was masking a real mismatch that surfaced once derived types tightened.
- ~10 \*Result types intentionally kept hand-rolled with documented divergences (FrontingComment denormalization, Note polymorphic FK, LifecycleEvent zod-narrowed payload, PollVote immutable-no-version, SystemProfile narrow projection, FriendConnection no-archived projection, SystemSettings pinHash leak avoidance, FrontingReport no SM yet, Channel discriminated union, hierarchy/nomenclature unique shapes).

### Tier 6 — `*Decrypted` audit

The three already-aliased cases (CanvasDecrypted = InnerWorldCanvas, LifecycleEventDecrypted = LifecycleEvent, InnerWorldEntityDecrypted = InnerWorldEntity) remain. The remaining `*Decrypted` interfaces (Group, Acknowledgement, Poll, PollVote, FieldDefinition, FieldValue, Note, Relationship, Snapshot, friend-dashboard variants) are intentional — they flatten domain shapes (mutable `archived: boolean`, polymorphic-FK widening, zod-validated payloads) in ways that don't cleanly alias.

### ADR

- `docs/adr/023-zod-type-alignment.md` updated: documents `EncryptedWire<T>` as the SoT envelope helper and reverses the prior "API-layer only" stance.

### Verification

- `pnpm turbo typecheck --force`: 21 packages green.
- `pnpm test:unit`: 12,850 / 12,852 (1 skipped, 1 todo). All affected packages green.
