---
# ps-86ya
title: Route import-pk and import-sp mapped types through validation schemas
status: completed
type: task
priority: normal
created_at: 2026-04-20T08:36:01Z
updated_at: 2026-04-20T08:47:36Z
parent: ps-h2gl
---

Align mapped-payload types in `packages/import-pk` (and close the same gap in `packages/import-sp`) with `@pluralscape/validation` `Create*BodySchema` shapes, so upstream plaintext-field additions produce compile errors in importers instead of silent drift.

Design spec: `docs/superpowers/specs/2026-04-20-import-pk-validation-types-design.md` (local-only).

## Pattern

```ts
export type MappedX = Omit<z.infer<typeof CreateXBodySchema>, "encryptedData" | ...> & {
  readonly encrypted: XEncryptedFields;
  // + engine-layer fields (bucketIds, fieldValues, memberIds, archived)
};
```

## Files to edit (6)

### import-pk

- [x] `packages/import-pk/src/mappers/member.mapper.ts` — `PkMappedMember` via `Omit<z.infer<CreateMemberBodySchema>, "encryptedData">`
- [x] `packages/import-pk/src/mappers/group.mapper.ts` — `PkMappedGroup` via `Omit<z.infer<CreateGroupBodySchema>, "encryptedData">`; widens `parentGroupId` and `sortOrder` from literals to schema types
- [x] `packages/import-pk/src/mappers/switch.mapper.ts` — `PkMappedFrontingSession` via `Omit<..., "encryptedData" | "endTime">`; add `brandId<MemberId>(resolved)` at the `buildSession` call sites (pattern matches `packages/import-sp/src/mappers/fronting-session.mapper.ts:56`)
- [x] `packages/import-pk/src/mappers/privacy-bucket-synthesis.ts` — `PkMappedPrivacyBucket` via `Omit<z.infer<CreateBucketBodySchema>, "encryptedData">`

### import-sp (closes same drift gap)

- [x] `packages/import-sp/src/mappers/member.mapper.ts` — `MappedMember` via Omit pattern
- [x] `packages/import-sp/src/mappers/bucket.mapper.ts` — `MappedPrivacyBucket` via Omit pattern

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm vitest run --project import-pk`
- [x] `pnpm vitest run --project import-pk-integration`
- [x] `pnpm vitest run --project import-sp`
- [x] `pnpm vitest run --project import-sp-integration`

## Non-goals

- No change to `*EncryptedFields` (already sourced from `@pluralscape/data`)
- No change to engine, persister, dependency-order, validators, or source code
- No runtime behavior change anywhere; pure type-shape refactor

## Summary of Changes

All four `packages/import-pk` mapper types (`PkMappedMember`, `PkMappedGroup`, `PkMappedFrontingSession`, `PkMappedPrivacyBucket`) and the two remaining hand-rolled `packages/import-sp` mapper types (`MappedMember`, `MappedPrivacyBucket`) now derive their schema-contributed fields via `Omit<z.infer<typeof Create*BodySchema>, "encryptedData" | ...>`. Upstream plaintext-field additions to `@pluralscape/validation` will now produce compile errors in both importers instead of silent drift.

One small runtime-adjacent change in `packages/import-pk/src/mappers/switch.mapper.ts`: resolved member IDs are now wrapped with `brandId<MemberId>(...)` before entering `buildSession`, matching the pattern in `packages/import-sp/src/mappers/fronting-session.mapper.ts:56`. `brandId` is a type-only brand (runtime identity), so all existing tests pass unchanged.

Verified with workspace-wide `pnpm typecheck`, `pnpm vitest` across `import-pk`, `import-pk-integration`, `import-sp`, `import-sp-integration` (536 passed, 12 skipped), `pnpm lint` on both packages, and live-API e2e runs (SP: 72 passed, PK: 34 passed).
