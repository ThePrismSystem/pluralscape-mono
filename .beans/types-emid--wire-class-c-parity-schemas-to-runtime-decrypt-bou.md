---
# types-emid
title: Wire Class C parity schemas to runtime decrypt boundaries
status: completed
type: task
priority: normal
created_at: 2026-04-27T14:30:14Z
updated_at: 2026-04-27T18:55:54Z
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

## Summary of Changes

Wired five encrypted-payload Zod schemas at their runtime decrypt boundaries.

### Codec primitive

- New `Base64ToUint8ArrayCodec` in `packages/validation/src/encryption-primitives.ts` — Zod 4.1+ `z.codec()` for binary↔base64 boundaries inside JSON-encoded AEAD plaintexts.

### ApiKey (Class C — codec-based)

- `ApiKeyEncryptedPayloadSchema` rewritten as `z.codec()` — wire side `publicKey: z.base64()`, memory side `publicKey: Uint8Array` with 32-byte refine.
- New transforms `decryptApiKeyPayload` / `encryptApiKeyPayload` in `packages/data/src/transforms/api-key.ts` using `Schema.parse` / `z.encode`.
- Round-trip tests cover both metadata and crypto variants.
- Parity test now asserts `z.output<>` ≡ `ApiKeyEncryptedPayload`.
- Used `z.custom<Uint8Array>` over `z.instanceof` (with inline comment) because `z.instanceof` produces `InstanceType<typeof Uint8Array>` which fails strict `Equal<>` parity.

### Snapshot, DeviceInfo (Class C — schema-parse)

- `decryptSnapshot` swapped from hand-rolled `assertSnapshotContent` to `SnapshotContentSchema.parse()`.
- New transform `decryptDeviceInfo` in `packages/data/src/transforms/session.ts` using `DeviceInfoSchema.parse()`.

### FrontingReport (T1 outlier — full canonical-chain extension)

- New canonical type `FrontingReportEncryptedInput` in `packages/types/src/analytics.ts`.
- New `FrontingReportEncryptedInputSchema` (with sub-schemas for `DateRange`, `MemberFrontingBreakdown`, `ChartDataset`, `ChartData`) in `packages/validation/src/fronting-report.ts`.
- New SoT manifest entry (Class A, `server: never` / `wire: never` placeholders documented for future endpoint formalization).
- New G3 parity test.
- `decryptFrontingReport` swapped from hand-rolled `assertFrontingReportEncryptedFields` to `FrontingReportEncryptedInputSchema.parse()`. Inline `FrontingReportEncryptedFields` interface and `AssertFrontingReportFieldsSubset` removed.
- Orphaned barrel re-export from `packages/data/src/index.ts` removed.

### Cleanup

- "Parity gate only" / "in-memory contract" comments removed from all wired validation modules; replaced with positive wiring references.
- Unused `assertArrayField` helper removed from `packages/data/src/transforms/decode-blob.ts` (zero callers after wiring). `assertObjectBlob` and `assertStringField` remain (still used by `friend-dashboard.ts` T2 path — out of scope).

### Verification (final `/verify`)

- `pnpm format` — clean
- `pnpm lint` — zero warnings
- `pnpm typecheck` — zero errors
- `pnpm types:check-sot` — all 4 parity gates green (types, Drizzle, Zod, OpenAPI-Wire)
- `pnpm test:unit` — 13024 passed (1 skipped, 1 todo across 1015 files)
- `pnpm test:integration` — 3055 passed (11 skipped across 152 files)
- `pnpm test:e2e` — 507 passed (2 skipped)

### Follow-ups deferred to separate beans

- Wire `decryptDeviceInfo` once the session-list endpoint plumbs `encryptedData`.
- Wire `decryptApiKeyPayload` / `encryptApiKeyPayload` when ApiKey crypto-variant lands client-side.
- Add `FrontingReportServerMetadata` / `FrontingReportWire` when report API endpoints are formalised.
- Inline or relocate `assertObjectBlob` / `assertStringField` after `friend-dashboard.ts` migrates to its own validation pattern.

### Branch / commits

`feat/types-emid-decrypt-wiring` — 8 implementation commits + 1 bean-tracking commit, top-down narrative: codec primitive → ApiKey codec → ApiKey transforms → Snapshot wiring → DeviceInfo transform → FrontingReport canonical chain → FrontingReport wiring → decode-blob cleanup.
