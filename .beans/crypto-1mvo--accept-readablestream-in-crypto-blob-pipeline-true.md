---
# crypto-1mvo
title: Accept ReadableStream in crypto blob pipeline (true streaming)
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T12:04:29Z
parent: crypto-cpir
---

Finding [PERF-1] from audit 2026-04-20. packages/crypto/src/blob-pipeline/encrypt-blob.ts:40, packages/crypto/src/symmetric.ts:76-96. encryptStream receives complete Uint8Array; 'streaming' is chunked-in-memory only. Fix: accept ReadableStream / AsyncIterable<Uint8Array> for true backpressure.

## Summary of Changes

encryptStreamAsync and encryptBlobStream accept `StreamInput` = `Uint8Array | ReadableByteStream | AsyncIterable<Uint8Array>`. Callers no longer have to materialize the full plaintext as a contiguous buffer for large blob uploads.

- Added `StreamInput` + `ReadableByteStream` types and the `toAsyncIterable` normalizer to `packages/crypto/src/symmetric.ts`.
- Added `encryptStreamAsync` (streaming input, chunked AEAD output with proper chunk-index AAD).
- Added `encryptBlobStream` and `EncryptBlobStreamParams` in `packages/crypto/src/blob-pipeline/encrypt-blob.ts`.
- Exported new APIs via `packages/crypto/src/index.ts` and `blob-pipeline/index.ts`.
- Added tests covering async iterable + ReadableByteStream inputs, backpressure, and empty-stream edge case.

Note: totalChunks is encoded in AAD, so output is still produced as a complete StreamEncryptedPayload at end-of-stream. Input-side backpressure is fully honoured; memory savings come from the caller not buffering the entire payload before calling encrypt.
