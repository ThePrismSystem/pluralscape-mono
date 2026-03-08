---
# db-1dza
title: Blob metadata table
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:44Z
updated_at: 2026-03-08T14:03:44Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Encrypted blob/media metadata tracking table

## Scope

- `blob_metadata`: id, system_id, storage_key (varchar — T3, S3 key or filesystem path for server retrieval), content_type (varchar — T3, MIME type for Content-Type header), size_bytes (integer — T3), purpose (varchar — T3, for quota/policy enforcement), thumbnail_blob_id (FK nullable — T3), uploaded_at (T3)
- Purpose values: 'avatar', 'member-photo', 'chat-attachment', 'journal-image', 'import-archive', 'safe-mode-media', 'report-export'
- Design: storage_key and content_type are T3 (server must read them to serve/route blobs)
- Design: all blob content is T1 encrypted client-side before upload — server stores ciphertext only
- Design: thumbnails are separate blobs (separate encrypted upload, linked via thumbnail_blob_id)
- Indexes: blob_metadata (system_id), blob_metadata (storage_key unique)
- Self-hosted fallback: storage_key is a local filesystem path when no S3 configured

## Acceptance Criteria

- [ ] blob_metadata table with storage key and content type
- [ ] All 7 purpose values supported
- [ ] Thumbnail reference linking
- [ ] Unique index on storage_key
- [ ] Migrations for both dialects
- [ ] Integration test: create blob metadata with thumbnail reference

## References

- features.md section 16 (Media Storage)
- ADR 009 (Blob/Media Storage)
