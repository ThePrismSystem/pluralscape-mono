---
# ps-lybb
title: "PR #525 review-driven fixes: packages/crypto hardening"
status: completed
type: task
priority: high
created_at: 2026-04-20T13:38:19Z
updated_at: 2026-04-20T13:55:42Z
---

Execute multi-agent review punch-list on chore/audit-m9-crypto: critical streaming correctness (decryptStream OOM cap, reader cancel, memzero), profile branding, QR schema v2, threat-model rewrite.

## Summary of Changes

### Security hardening (packages/crypto/src)

- **symmetric.ts**: Added `MAX_DECRYPT_STREAM_BYTES` (u32 max, 4 GiB-1), `MAX_PLAINTEXT_CHUNK_BYTES` (16 MiB), `MAX_STREAM_CHUNKS` (65_536) constants. `decryptStream` now rejects impossible payloads (oversized totalLength, oversized chunk count, cross-check totalLength ≤ chunks × chunk-max) before allocation. `readerIterable` calls `reader.cancel()` on error/abandonment. `collectPlaintextChunks` memzeros buffered plaintext on throw. `encryptStreamAsync` memzeros plaintext chunks in finally. `ReadableByteStream.read()` uses discriminated union. Dropped Uint8Array branch of `toAsyncIterable`. `.map` refactor of encryption loop. byteLength normalization.

- **blob-pipeline/encrypt-blob.ts**: Serializer asserts payload.chunks.length ≤ u32 max and payload.totalLength ≤ u32 max before setUint32.
- **blob-pipeline/decrypt-blob.ts**: Deserializer cross-checks totalLength against MAX_DECRYPT_STREAM_BYTES alongside existing MAX_STREAM_CHUNKS check.
- **blob-pipeline/blob-constants.ts**: MAX_STREAM_CHUNKS moved to symmetric.ts as the stream-format source of truth.

### Argon2id profile branding (ADR 037 tightening)

- **crypto.constants.ts**: `Argon2idProfile<K extends 'master-key'|'transfer'>` now carries a phantom `unique symbol` brand (optional property). Compile-time check prevents cross-tier mixing. `assertArgon2idProfile` runtime validator enforces OWASP memlimit floor (19 MiB) and positive integer opslimit.
- **auth-key.ts, pin.ts, device-transfer.ts**: `assertArgon2idProfile` called before `pwhash`/`pwhashStr`.

### QR payload schema v2 (threat model L6 enforcement)

- **device-transfer.ts**: `encodeQRPayload` emits `{ version: 2, requestId, salt }`. `decodeQRPayload` rejects payloads missing version, with wrong version, carrying legacy `code` field, or > 1 KiB. `isQRPayloadShape` simplified — loose `Record<string, unknown>` cast replaced with per-field shape probes.
- **apps/mobile/src/hooks/use-device-transfer.ts**: 21-line doc block collapsed to 3-line pointer.

### Tests

- **symmetric.test.ts**: Migrated to setupSodium/teardownSodium helpers. Added tests: impossible-payload guards (oversized totalLength, chunk count, cross-check); encryptStreamAsync memzero on success and error; reader.cancel called on downstream error; single-chunk tail path; zero-length chunk skip.
- **device-transfer.test.ts**: Added tests for version 2 emission, missing version rejection, v1 rejection, legacy code field rejection, >1 KiB payload rejection.
- **argon2id-profiles.test.ts**: Added frozen-tuple mutation assertions; `assertArgon2idProfile` acceptance/rejection tests (null, non-object, non-integer opslimit, opslimit < 1, sub-OWASP memlimit, missing fields).
- **blob-pipeline/encrypt-blob.test.ts**: Migrated to setupSodium helpers. Added T1 above-threshold Uint8Array round-trip.

### Docs

- **threat-model.md**: M4 rewritten — 10-digit code, TRANSFER profile (t=3 m=32 MiB), ~175 days offline brute-force (vs stale 28 hours). Recommendations re-marked Implemented. L6 updated to describe v2 strict rejection (replacing 'silently ignores legacy code' language).
- **adr/037-argon2id-context-profiles.md**: Pseudocode fixed (`32 * 1_024 * 1_024` literals, not free identifier). Brand-indicator paragraph added.
- **packages/crypto/docs/mobile-key-lifecycle.md**: Bean-ID breadcrumb replaced with `(ADR 037 / device-transfer.ts)`.

### Verification

- `pnpm typecheck` — 21/21 packages pass.
- `pnpm lint` — 17/17 packages pass (0 warnings).
- `pnpm vitest run --project crypto` — 842 tests pass (+21 new).
