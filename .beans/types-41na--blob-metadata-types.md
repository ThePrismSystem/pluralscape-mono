---
# types-41na
title: Blob metadata types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:34Z
updated_at: 2026-03-08T14:22:06Z
parent: types-im7i
blocked_by:
  - types-av6x
---

BlobMetadata type for encrypted media and file attachment tracking.

## Scope

- `BlobMetadata`: id (BlobId), systemId, storageKey (string), contentType (string — MIME type), sizeBytes (number), purpose (BlobPurpose), encryptionTier (1 | 2 — determines decryption key), bucketId (BucketId | null — set when tier=2), thumbnailBlobId (BlobId | null), uploadedAt (UnixMillis)
- `BlobPurpose`: 'avatar' | 'member-photo' | 'chat-attachment' | 'journal-image' | 'import-archive' | 'safe-mode-media' | 'report-export'
- `BlobUploadRequest`: contentType, sizeBytes, purpose — for presigned URL generation
- `BlobDownloadRef`: blobId, storageKey, contentType — for client-side decryption
- All blob content is T1/T2 encrypted before upload (client-side)
- Thumbnails are separate encrypted blobs generated client-side

## Acceptance Criteria

- [ ] BlobMetadata with purpose as actual field
- [ ] encryptionTier (1 | 2) for key selection
- [ ] bucketId for T2 blobs
- [ ] Thumbnail reference for image blobs
- [ ] Upload/download reference types
- [ ] Unit tests for metadata construction and purpose validation

## References

- features.md section 16 (Media Storage)
- ADR 009 (Blob/Media Storage)
