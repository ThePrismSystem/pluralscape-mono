---
# types-600s
title: Apply canonical chain to CheckInRecord (server-only encrypted payload)
status: completed
type: task
priority: normal
created_at: 2026-04-25T19:17:08Z
updated_at: 2026-04-26T10:24:13Z
parent: ps-y4tb
---

## Background

Discovered during ps-y4tb fleet rollout (PR 2, Task 4.3). The plan classified `CheckInRecord` as Class D (nullable encryption), but its structure is divergent: the domain has NO encrypted fields (all properties are server-visible plaintext), while the server row carries an OPTIONAL `encryptedData: EncryptedBlob | null` payload that is recorded with check-in responses (e.g., mood/note attached to a response).

`CheckInRecordServerMetadata` also carries `idempotencyKey: string | null` with a JSDoc comment "never leaked to clients". Today this field is plain `string | null` rather than `ServerInternal<string | null>`, so applying `EncryptedWire<T>` directly would leak it into the wire type.

## Required work

1. Annotate `idempotencyKey` on `CheckInRecordServerMetadata` as `ServerInternal<string | null>` so `EncryptedWire<T>`'s `StripServerInternal<T>` mapped type strips it correctly.
2. Add `CheckInRecordResult = EncryptedWire<CheckInRecordServerMetadata>` (no `EncryptedFields` / `EncryptedInput` aliases — the domain has none).
3. Replace `CheckInRecordWire = Serialize<CheckInRecord>` with `CheckInRecordWire = Serialize<CheckInRecordResult>` so the wire type includes `encryptedData: string | null`.
4. Update `__sot-manifest__` entry: domain + server + result + wire (no encryptedFields / encryptedInput).
5. Update `__tests__/sot-manifest.test.ts` to assert the new slots.
6. Update `scripts/openapi-wire-parity.type-test.ts` to use `Equal<CheckInRecordResponseOpenApi, CheckInRecordWire>` (G7 form).
7. Verify `pnpm types:check-sot` and unit / integration tests still pass.

## Why deferred from PR 2

Class A/B entities follow a uniform pattern (`Pick<X, XEncryptedFields>` for `EncryptedInput`, `EncryptedWire<XServerMetadata>` for `Result`). CheckInRecord requires a separate `ServerInternal` annotation and a manifest variant without `encryptedInput` / `encryptedFields` slots. Deferring keeps PR 2's diff focused on the canonical pattern.

## Cross-references

- Parent: ps-y4tb (Encrypted-entity SoT consolidation)
- Related: ADR-023 (Zod-types alignment), `packages/types/src/server-internal.ts`, `packages/types/src/encrypted-wire.ts`
- File: `packages/types/src/entities/check-in-record.ts`

## Acceptance

- [ ] `idempotencyKey` annotated `ServerInternal<string | null>`
- [ ] `CheckInRecordResult` and `CheckInRecordWire` defined per the new pattern
- [ ] `__sot-manifest__` extended; manifest test updated
- [ ] OpenAPI parity uses G7 `Equal<MemberResponseOpenApi, MemberWire>` form
- [ ] `pnpm types:check-sot` passes
- [ ] CI green

## Summary of Changes

CheckInRecord (hybrid entity — plaintext domain + optional encrypted blob) now follows the canonical chain:

- `idempotencyKey` annotated `ServerInternal<string> | null` (not `ServerInternal<string | null>` — the intersection collapses null branches, so the brand goes on the non-null side); PG and SQLite `idempotencyKey` columns mirror via `.$type<ServerInternal<string>>()`
- `CheckInRecordResult = EncryptedWire<CheckInRecordServerMetadata>` and `CheckInRecordWire = Serialize<CheckInRecordResult>`
- `__sot-manifest__` entry gains `result`; manifest test asserts the new shape
- OpenAPI `CheckInRecordResponse` got a `required` array; G7 parity assertion added (`Equal<…CheckInRecordResponse, CheckInRecordWire>`)

Two SoT-wide adjustments shipped alongside:

- `StripServerInternal<T>` in `encrypted-wire.ts` widened to use `Extract<T[K], ServerInternal<unknown>>` so nullable server-only fields (`ServerInternal<X> | null`) are also stripped — the previous `extends` form missed unions
- `__serverInternal` is now a real runtime `Symbol(...)` and re-exported from `@pluralscape/types`, so cross-package Drizzle column inferences over `.$type<ServerInternal<…>>()` can be named in declaration emit (was tripping TS4023)

PR: refactor/ps-y4tb-batch2-entity-migrations (commit 002772a0)
