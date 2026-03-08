---
# db-1dza
title: Blob metadata table
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:44Z
updated_at: 2026-03-08T14:21:20Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Encrypted blob/media metadata tracking table for avatars, photos, attachments, and other media.

## Scope

### Tables

- **`blob_metadata`**: id (UUID PK), system_id (FK → systems, NOT NULL), storage_key (varchar, T3, NOT NULL — S3 key or filesystem path), content_type (varchar, T3, NOT NULL — MIME type), size_bytes (integer, T3, NOT NULL), encryption_tier (integer, T3, NOT NULL — 1 or 2, determines decryption key), bucket_id (FK → buckets, nullable, T3 — set when encryption_tier=2), purpose (varchar, T3), thumbnail_blob_id (FK → blob_metadata, nullable, T3), uploaded_at (T3, NOT NULL, default NOW())
  - CHECK: `size_bytes > 0`
  - encryption_tier: 1 = encrypted with master key (private), 2 = encrypted with bucket key (shared)

### Purpose values

'avatar', 'member-photo', 'chat-attachment', 'journal-image', 'import-archive', 'safe-mode-media', 'report-export'

### Design decisions

- storage_key and content_type are T3 (server must read them to serve/route blobs)
- All blob content is T1/T2 encrypted client-side before upload
- Thumbnails are separate encrypted blobs linked via thumbnail_blob_id
- Self-hosted fallback: storage_key is a local filesystem path when no S3 configured

### Indexes

- blob_metadata (system_id)
- blob_metadata (storage_key) — unique

## Acceptance Criteria

- [ ] blob_metadata table with encryption_tier column (1 or 2)
- [ ] bucket_id FK for T2 blobs (nullable, set when tier=2)
- [ ] NOT NULL on storage_key, content_type, size_bytes, encryption_tier
- [ ] CHECK: size_bytes > 0
- [ ] All 7 purpose values supported
- [ ] Thumbnail reference linking via self-FK
- [ ] Unique index on storage_key
- [ ] Migrations for both dialects
- [ ] Integration test: create blob metadata for T1 and T2 blobs

## References

- features.md section 16 (Media Storage)
- ADR 009 (Blob/Media Storage)
