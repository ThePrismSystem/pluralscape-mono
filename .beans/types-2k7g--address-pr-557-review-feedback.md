---
# types-2k7g
title: "Address PR #557 review feedback"
status: completed
type: task
priority: normal
created_at: 2026-04-24T22:47:07Z
updated_at: 2026-04-24T22:55:58Z
parent: types-ltel
---

Implements in-scope review follow-ups for PR #557 (EncryptedWire<T> hardening + \*Result collapse).

## Scope

### Important

- [x] Add EncryptedWire<T> nullability type tests (4 expectTypeOf assertions in openapi-wire-parity.type-test.ts)
- [x] Mobile avatar persister: decrypt-and-assert avatar happy-path (member.persister.test.ts)

### Suggestions

- [x] Fix stale AuthKey comment in auth.integration.test.ts:116 (AuthKey → AuthKeyMaterial)
- [x] Simplify EncryptedWire<T> constraint (single bound)
- [x] Trim EncryptedWire<T> docstring + fix inverted nullability comment
- [x] Consolidate KNOWN_SATURATION_LEVELS and POLL_KINDS re-export style in enums.ts
- [x] Trim import-sp re-export narrative in import-engine.ts
- [x] Replace `as never` with brandId<T>(...) in relationships.test.ts fixtures
- [x] Add PlaintextFields<T, K> helper in @pluralscape/types + use in 3 data transforms

## Out-of-scope (follow-up beans under types-ltel)

1. EncryptedBase64 brand on wire base64 strings
2. ServerInternal<T> marker for denormalized server-only fields

## Summary of Changes

All in-scope review follow-ups for PR #557 landed.

### Important

- `scripts/openapi-wire-parity.type-test.ts`: added 4 `expectTypeOf` assertions pinning the nullable/non-nullable arms of `EncryptedWire<T>` (synthetic pair + `MemberServerMetadata`/`SystemServerMetadata` bridges).
- `apps/mobile/.../member.persister.test.ts`: avatar happy-path now decrypts the captured `encryptedData` with `decodeAndDecryptT1` and asserts the plaintext `avatarSource` is `{ kind: "blob", blobRef: "blob_1" }`.

### Suggestions

- `auth.integration.test.ts:116`: `AuthKey` → `AuthKeyMaterial` in comment.
- `packages/types/src/encrypted-wire.ts`: collapsed the union constraint to a single `EncryptedBlob | null` bound and trimmed the narrative docstring to a 3-line summary.
- `packages/db/src/helpers/enums.ts`: `KNOWN_SATURATION_LEVELS` and `POLL_KINDS` now use inline re-exports (matching `POLL_STATUSES`).
- `packages/import-sp/src/engine/import-engine.ts`: trimmed the 4-line re-export block to a single-line comment.
- `apps/api/src/__tests__/routes/relationships.test.ts`: replaced 6 `as never` casts with `brandId<…>(…)` / `toUnixMillis(…)`.
- `packages/types/src/encrypted-wire.ts` + 3 data transforms: added a `PlaintextFields<T, K>` helper (sibling to `EncryptedWire<T>`) and used it in `fronting-comment`, `fronting-session`, `innerworld-region` transforms.

### Naming deviation from plan

Plan called the new helper `Plaintext<T, K>`, but `encryption-primitives.ts` already exports a single-arity `Plaintext<T>` branded type used by `AuditLogEntry.detail`. Renaming that brand would have cascaded; the new projection helper is `PlaintextFields<T, K>` instead, with a JSDoc note pointing at the nominal brand to disambiguate.

### Follow-ups

- `types-ecol` — `EncryptedBase64` brand on wire base64 strings (parent: `types-ltel`).
- `types-u87m` — `ServerInternal<T>` marker for denormalized server-only fields (parent: `types-ltel`).

### Verification

- `pnpm types:check-sot` — pass.
- `pnpm typecheck` — pass (21/21).
- `pnpm lint` — pass (17/17, zero warnings).
- `pnpm vitest run --project {mobile,api,data,types}` — pass (428 api, 124 mobile, 33 data, 48 types files; 7922 tests total).
