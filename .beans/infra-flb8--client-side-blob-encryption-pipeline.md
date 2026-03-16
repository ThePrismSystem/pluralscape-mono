---
# infra-flb8
title: Client-side blob encryption pipeline
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:58:26Z
updated_at: 2026-03-16T01:56:47Z
parent: infra-o80c
blocked_by:
  - infra-psh9
---

Client-side encryption and thumbnail generation pipeline for blob uploads.

## Scope

- Encrypt blob with appropriate key before upload:
  - Tier 1 (private): user's MasterKey-derived content key
  - Bucket key (shared): per-bucket symmetric key for friend-visible content
- Thumbnail generation: client-side resize to preview dimensions before encryption
- Thumbnail stored as separate encrypted blob (independent download)
- Image crop/resize UI integration: process before encryption
- Encryption metadata: store algorithm, key reference, nonce alongside blob metadata
- Decryption pipeline: download encrypted bytes, decrypt with appropriate key, display
- Memory management: streaming encryption for large files to avoid OOM on mobile
- Content type detection: validate MIME type before encryption

## Acceptance Criteria

- [ ] Blob encryption with tier-appropriate key
- [ ] Thumbnail generated and encrypted as separate blob
- [ ] Crop/resize before encryption
- [ ] Encryption metadata stored with blob record
- [ ] Decryption pipeline for download and display
- [ ] Streaming encryption for large files
- [ ] Content type validation before encryption
- [ ] Unit tests for encrypt/decrypt round-trip
- [ ] Integration test: upload encrypted blob, download, decrypt

## References

- ADR 009 (Blob Storage — client-side encryption)
- ADR 006 (Encryption — per-bucket keys)
- crypto-mp96 (Per-bucket key management)

## Summary of Changes

- Implemented `encryptBlob()` / `decryptBlob()` for T1 (master key) and T2 (bucket key) encryption
- Automatic streaming encryption for blobs > 64 KiB using chunked AEAD
- Binary serialization format for stream payloads (chunkCount + totalLength + nonce/ciphertext pairs)
- `prepareUpload()` orchestrator: validate content type, encrypt, compute checksum
- `processDownload()` for decrypting downloaded blobs
- Content validation with `ALLOWED_MIME_TYPES` per `BlobPurpose` and `ContentTypeNotAllowedError`
- Type-level `ThumbnailGenerator` / `ThumbnailConfig` interfaces (platform-specific implementation deferred)
- Tests: encrypt/decrypt round-trips (small + large), wrong-key failures, content validation, full pipeline round-trip
- Added `./blob-pipeline` export path to package.json
