---
# types-41na
title: Blob metadata types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:34Z
updated_at: 2026-03-08T14:03:34Z
parent: types-im7i
blocked_by:
  - types-av6x
---

BlobMetadata type for encrypted media and file attachment tracking

## Scope

- `BlobMetadata`: id (BlobId), systemId, storageKey (string — S3 key or filesystem path), contentType (string — MIME type), sizeBytes (number), encryptionKeyRef (master key or bucket key reference), thumbnailBlobId (BlobId | null), uploadedAt (UnixMillis)
- `BlobPurpose`: 'avatar' | 'member-photo' | 'chat-attachment' | 'journal-image' | 'import-archive' | 'safe-mode-media' | 'report-export'
- `BlobUploadRequest`: contentType, sizeBytes, purpose — for presigned URL generation
- `BlobDownloadRef`: blobId, storageKey, contentType — for client-side decryption
- All blob content is T1 encrypted before upload (client-side encryption)
- Thumbnails are separate encrypted blobs generated client-side
- Storage backend abstracted: S3-compatible or local filesystem (ADR 009)

## Acceptance Criteria

- [ ] BlobMetadata tracks storage location, size, and content type
- [ ] All 7 blob purposes defined
- [ ] Thumbnail reference for image blobs
- [ ] Upload/download reference types for client-server flow
- [ ] Encryption key reference for decryption routing
- [ ] Unit tests for metadata construction and purpose validation

## References

- features.md section 16 (Media Storage)
- ADR 009 (Blob/Media Storage)
