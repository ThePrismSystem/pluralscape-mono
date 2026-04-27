---
# types-emid
title: Wire Class C parity schemas to runtime decrypt boundaries
status: in-progress
type: task
priority: normal
created_at: 2026-04-27T14:30:14Z
updated_at: 2026-04-27T17:28:29Z
---

Three Zod parity schemas for Class C entities are currently parity-gates only — not yet wired to a runtime parse boundary. This bean tracks wiring them at the decrypt callsites once those callsites materialize.

## Schemas

- `ApiKeyEncryptedPayloadSchema` (`packages/validation/src/api-key.ts`)
- `DeviceInfoSchema` (`packages/validation/src/session.ts`)
- `SnapshotContentSchema` (`packages/validation/src/snapshot.ts`)

## Why deferred

The schemas exist as compile-time parity gates so type and Zod stay in sync. Runtime parsing requires a JSON-vs-binary adapter for `publicKey` (the in-memory schema rejects strings). Without a concrete decrypt callsite to wire to, runtime adoption was deferred from the original ADR-023 Class C extension PR (#578).

## Acceptance

- Schemas consumed at the actual decrypt callsites for ApiKey / Session / SystemSnapshot blobs
- JSON-vs-binary adapters in place (e.g., `EncryptedBase64Schema` for `publicKey` in ApiKeyEncryptedPayload)
- The "in-memory contract" comments in the validation modules removed once wired

## Related

- ps-qmyt (original Class C extension)
- ps-8e36 (PR #578 review fixes)
- types-8f84 (SnapshotContent server-shaped junction projections — adjacent cleanup)

## Design

Spec at `docs/superpowers/specs/2026-04-27-types-emid-design.md` (gitignored, local-only).

## Expanded scope (post-design)

Audit of `packages/data/src/transforms/` confirmed only **2 outliers** out of 23 T1 transforms still use hand-rolled assertions instead of Zod schema validation. One (`snapshot.ts`) was already in scope; the other (`fronting-report.ts`) is added here.

### Final scope

1. **Codec primitive**: introduce `Base64ToUint8ArrayCodec` in `packages/validation/src/encryption-primitives.ts` (Zod 4.1+ `z.codec()` for binary↔base64 boundaries inside JSON-encoded AEAD plaintexts).
2. **ApiKey** — codec-based wiring (only payload with `Uint8Array` field). New transform `packages/data/src/transforms/api-key.ts`.
3. **DeviceInfo** — `Schema.parse()` wiring. New transform `packages/data/src/transforms/session.ts`.
4. **SnapshotContent** — replace `assertSnapshotContent` with `Schema.parse()` in existing `packages/data/src/transforms/snapshot.ts`.
5. **FrontingReportEncryptedInput** — full canonical-chain extension (canonical type in `analytics.ts`, Zod schema + sub-schemas in `packages/validation/src/fronting-report.ts`, SoT manifest entry, parity test, runtime wiring).
6. Drop "parity gate only / in-memory contract" comments from all wired validation modules.
7. Cleanup unused exports from `decode-blob.ts` after the swaps.

### Why `z.codec()` over alternatives

Zod 4.1+ `z.codec()` is purpose-built for wire↔memory boundaries; the canonical Zod docs literally use `base64 ↔ Uint8Array` as the headline example. Pluralscape is on `zod ^4.3.6`. Matches the wire format used by JOSE/age/Tink/libsodium.js (binary as base64 string in JSON) while preserving `Uint8Array` in the in-memory domain type. Custom JSON replacer/reviver in `encryptJSON` was rejected — invents a sentinel-tagged shape that breaks OpenAPI parity and couples crypto to a serialization concern. CBOR/MessagePack switch was rejected — over-engineered for one 32-byte field.

## Updated acceptance

- All five payloads (ApiKey / DeviceInfo / SnapshotContent / FrontingReportEncryptedInput / no other T1 outliers) validated by Zod at decrypt boundaries.
- `Base64ToUint8ArrayCodec` exported from `packages/validation/`.
- ApiKey `publicKey: Uint8Array` round-trips through encrypt/decrypt cycles in tests.
- `FrontingReport` has a canonical-chain entry with parity test in the SoT manifest.
- All "parity gate only / in-memory contract" comments removed from validation modules.
- `/verify` green (full suite — format, lint, typecheck, unit, integration, e2e).

## Related

- ps-qmyt (original Class C extension)
- ps-8e36 (PR #578 review fixes)
- types-8f84 (SnapshotContent server-shaped junction projections — adjacent cleanup, separate)
- ps-y4tb (parent epic — encrypted-entity SoT consolidation)

## Plan

Implementation plan at `docs/superpowers/plans/2026-04-27-types-emid.md` (gitignored, local-only).

9 tasks structured as bite-sized TDD steps:

1. `Base64ToUint8ArrayCodec` primitive
2. `ApiKeyEncryptedPayloadSchema` rewrite as `z.codec()`
3. ApiKey decrypt/encrypt transforms with round-trip tests
4. `SnapshotContentSchema` wired in `decryptSnapshot`
5. `decryptDeviceInfo` transform with `DeviceInfoSchema`
6. FrontingReport canonical-chain extension (type + Zod + parity test + SoT manifest)
7. `FrontingReportEncryptedInputSchema` wired in `decryptFrontingReport`
8. Cleanup unused `decode-blob.ts` helpers
9. Final `/verify` + bean closeout
