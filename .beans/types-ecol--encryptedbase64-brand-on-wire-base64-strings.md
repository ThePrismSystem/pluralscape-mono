---
# types-ecol
title: EncryptedBase64 brand on wire base64 strings
status: todo
type: task
created_at: 2026-04-24T22:55:22Z
updated_at: 2026-04-24T22:55:22Z
parent: types-ltel
---

Follow-up from PR #557 review (types-2k7g).

## Problem

`EncryptedWire<T>` converts `EncryptedBlob` (or `EncryptedBlob | null`) into `string` (or `string | null`) — raw, unbranded. Nothing on the type system prevents mixing an arbitrary string (e.g. an ID) with a wire-form encrypted payload.

## Scope

- Introduce an `EncryptedBase64` brand in `@pluralscape/types`.
- Brand the return type of `encryptedBlobToBase64` / `encryptedBlobToBase64OrNull` (packages/data).
- Thread the brand through `EncryptedWire<T>` so `encryptedData` on the wire is `EncryptedBase64 | (EncryptedBase64 | null)`.
- Reconcile with `Serialize<T>` (which currently unwraps brands) and the OpenAPI parity test (which generates raw `string`).

## Decisions needed

Either:

- Narrow `Serialize<T>` to preserve specific brands (e.g. `EncryptedBase64`), or
- Assert weaker on the OpenAPI side with a `BrandedString<Tag>` equivalence helper.

Requires a parity-test design call before implementation.

## Acceptance

- `openapi-wire-parity.type-test.ts` passes with `encryptedData: EncryptedBase64` (or branded equivalent).
- Zero regression in existing 19 `EncryptedWire<T>` consumers.
- ADR note in `docs/adr/023-zod-type-alignment.md` documenting the parity bridge.
