---
# crypto-zy1h
title: Fix blob encryption pipeline PR review findings
status: completed
type: task
priority: normal
created_at: 2026-03-16T04:12:40Z
updated_at: 2026-04-16T07:29:36Z
parent: infra-o80c
---

Address all 15 findings from PR #133 review: extract shared constants, discriminated unions, assertion functions, BLAKE2b naming fix, stream deserialization hardening, delete download-pipeline, simplify bytesToHex, MIME normalization, tighten ThumbnailResult, typed errors, update exports, add missing tests.

## Summary of Changes

- Extracted shared constants (KDF_CONTEXT_BLOB, SUBKEY_BLOB_ENCRYPTION, U32_SIZE, STREAM_THRESHOLD, MAX_STREAM_CHUNKS) into blob-constants.ts
- Refactored EncryptBlobParams, DecryptBlobParams, PrepareUploadParams to discriminated union types (T2 now requires bucketId)
- Replaced `as AeadKey` casts with assertAeadKey() assertion function; added assertAeadNonce() on deserialized nonces
- Fixed BLAKE2b mislabeled as SHA-256 (renamed computeSha256Hex -> computeBlake2bHex, SHA256_HEX_LENGTH -> BLAKE2B_32_HEX_LENGTH)
- Hardened stream deserialization with bounds checks (header length, MAX_STREAM_CHUNKS, per-chunk truncation guards)
- Tightened non-streamed payload check from nonce-only to nonce + AEAD_TAG_BYTES
- Deleted trivial download-pipeline.ts pass-through; tests use decryptBlob directly
- Simplified bytesToHex with Array.from
- Added case-insensitive MIME type normalization in validateBlobContentType
- Tightened ThumbnailResult.mimeType from string to ThumbnailConfig["format"]
- Replaced all bare Error throws with InvalidInputError
- Updated index.ts exports (removed processDownload/ProcessDownloadParams)
- Added comprehensive decrypt-blob.test.ts (12 tests covering edge cases, tampering, streams, T2, zero-length)
- Updated existing tests for new discriminated union types and added MIME case-insensitivity + T2 pipeline tests
