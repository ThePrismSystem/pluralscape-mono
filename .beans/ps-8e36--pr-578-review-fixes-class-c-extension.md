---
# ps-8e36
title: "PR #578 review fixes — Class C extension"
status: completed
type: task
priority: normal
created_at: 2026-04-27T14:10:54Z
updated_at: 2026-04-27T14:38:59Z
---

Address all critical, important, and suggestion items from the multi-agent review of PR #578 (ps-qmyt Class C canonical-chain extension).

## Plan

See `/home/theprismsystem/.claude-prism/plans/fix-all-the-critical-harmonic-waffle.md`

## Tasks

### Critical

- [x] 1.1 Register `ApiKey` in `scripts/openapi-wire-parity.type-test.ts`
- [x] 1.2 Add E2E negative-property assertions in `apps/api-e2e/src/tests/api-keys/crud.spec.ts`

### Important — Documentation errata

- [x] 2.1 Replace nonexistent type names + line citation in `ApiKeyWire` JSDoc + condense
- [x] 2.2 Fix SoT manifest header docstring contradiction
- [x] 2.3 ADR-023 — taxonomy intro + sharpen Class C wire clause + formalize `<X>ServerVisible`
- [x] 2.4 Restate `ApiKeyEncryptedPayloadSchema` warning as positive contract

### Important — Type / Schema hardening

- [x] 3.1 Schema-level invariants (`name.min(1)`, `publicKey.length === 32`)
- [x] 3.2 New `T3EncryptedBytes` brand + retrofit ApiKey.encryptedKeyMaterial + WebhookDelivery.encryptedData
- [x] 3.3 Regression trap: pin exact `ApiKeyServerVisible` keyset

### Important — Test coverage

- [x] 4.1 Runtime safeParse tests for `ApiKeyEncryptedPayloadSchema`
- [x] 4.2 Runtime safeParse tests for `DeviceInfoSchema`
- [x] 4.3 Runtime safeParse tests for `SnapshotContentSchema`

### Suggestions

- [x] 5.1 Couple `ApiKeyEncryptedPayload.keyType` to `ApiKey.keyType` via exhaustiveness assertion
- [x] 5.2 `DeviceInfo` JSDoc — acknowledge `encryptedData` nullability
- [x] 5.3 `// TODO(types-8f84)` marker at `SnapshotContent` junction-type usage
- [x] 5.4 Update bean types-8f84 — symbol reference instead of line citation
- [x] 5.5 Drop redundant Class C manifest inline one-liner comments
- [x] 5.6 Drop redundant `ApiKeyEncryptedPayload` JSDoc paragraph
- [x] 5.7 Open follow-up bean (`types-emid`) for wiring parity gates at decrypt boundary

## Skipped (user-confirmed)

- 3.4 SoT manifest `class` discriminator — structural distinction already exists; 2.2 docstring fix addresses reader confusion.

## Summary of Changes

All critical, important, and suggestion items from the multi-agent review of PR #578 are addressed.

### Critical (2)

- **1.1** Registered `ApiKey` in `scripts/openapi-wire-parity.type-test.ts` — `components["schemas"]["ApiKeyResponse"] ≡ ApiKeyWire` parity gate locks in the fail-closed allowlist.
- **1.2** Added E2E negative-property assertions to `apps/api-e2e/src/tests/api-keys/crud.spec.ts` — list/get response bodies must not expose `tokenHash`, `encryptedData`, `encryptedKeyMaterial`, or `accountId`.

### Important — Documentation (4)

- **2.1** Rewrote `ApiKeyWire` JSDoc — replaced nonexistent `ApiKeyResponse`/`ApiKeyCreateResponse` symbols with `ApiKeyResult`/`ApiKeyCreateResult`; dropped rotting line citation; condensed.
- **2.2** Fixed SoT manifest header docstring — Class C entries now correctly described (was contradicting them).
- **2.3** ADR-023 — added Class A/C/E taxonomy intro; sharpened Class C wire-shape clause to state the Class E sidecar rule explicitly; formalized `<X>ServerVisible` naming convention.
- **2.4** Restated `ApiKeyEncryptedPayloadSchema` JSDoc as positive in-memory contract; added inline TODO at `publicKey` Uint8Array site for grep-discoverability.

### Important — Type / Schema hardening (3)

- **3.1** Added `name.min(1)` and `publicKey.length === 32` (using `PUBLIC_KEY_BYTE_LENGTH`) refines on `ApiKeyEncryptedPayloadSchema`.
- **3.2** Introduced `T3EncryptedBytes` brand mirroring `EncryptedBase64`; retrofitted `ApiKeyServerMetadata.encryptedKeyMaterial` and `WebhookDeliveryServerMetadata.encryptedData`; `.$type<T3EncryptedBytes>()` on Drizzle columns; `encryptWebhookPayload` brand-constructs at the encrypt site; `toT3EncryptedBytes` helper in `apps/api/src/lib/encrypted-blob.ts` mirrors `toServerSecret`.
- **3.3** Added `keyof ApiKeyServerVisible` regression trap in `sot-manifest.test.ts` — pins the exact 9-key allowlist so widening fails the test.

### Important — Test coverage (3)

- **4.1** Created `packages/validation/src/__tests__/api-key.test.ts` — 9 `safeParse` tests covering both variants of the discriminated union, unknown discriminator rejection, name-empty rejection, publicKey size mismatches.
- **4.2** Created `packages/validation/src/__tests__/session.test.ts` — 5 `safeParse` tests for `DeviceInfoSchema`.
- **4.3** Created `packages/validation/src/__tests__/snapshot.test.ts` — 6 `safeParse` tests for `SnapshotContentSchema` including invalid relationship type / missing fields / invalid innerworld entityType.

### Suggestions (7)

- **5.1** Compile-time exhaustiveness assertion that `ApiKeyEncryptedPayload["keyType"]` ≡ `ApiKey["keyType"]` in `sot-manifest.test.ts`.
- **5.2** `DeviceInfo` JSDoc acknowledges `encryptedData: EncryptedBlob | null`.
- **5.3** Inline `// TODO(types-8f84):` marker at `SnapshotContent`'s server-shaped junction-type fields.
- **5.4** Updated `types-8f84` bean — replaced rotting line citation with field-name references.
- **5.5** Stripped redundant Class C manifest inline one-liner comments from all three Class C entries (~3 lines saved each).
- **5.6** Dropped redundant `ApiKeyEncryptedPayload` JSDoc paragraph that restated the type definition.
- **5.7** Created follow-up bean `types-emid` tracking wiring of the three Class C parity schemas to runtime decrypt boundaries.

### Skipped (user-confirmed)

- **3.4** SoT manifest `class` discriminator field — structural distinction already exists; 2.2 docstring fix addresses reader confusion. ~50 lines of churn avoided for purely declarative labeling.

### Verification

- `pnpm types:check-sot` — green (4/4 parity gates)
- `pnpm typecheck` — green
- `pnpm lint` — zero warnings
- `pnpm format` — clean
- `pnpm test:unit` — 13000 passed / 1 skipped / 1 todo
- `pnpm test:integration` — 3055 passed / 11 skipped
- `pnpm test:e2e` — 507 passed / 2 skipped
