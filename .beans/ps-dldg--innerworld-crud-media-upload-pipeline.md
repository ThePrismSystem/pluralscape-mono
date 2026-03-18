---
# ps-dldg
title: Innerworld CRUD + Media Upload Pipeline
status: completed
type: epic
priority: normal
created_at: 2026-03-18T00:10:44Z
updated_at: 2026-03-18T01:19:22Z
---

Implement 6 tasks across 2 epics: innerworld CRUD (canvas, regions, entities) and blob upload pipeline (presigned URLs, confirmation, download/delete)

## Tasks

### Phase 1: Shared Infrastructure

- [x] 1a. Audit event types
- [x] 1b. Validation schemas (innerworld + blob)
- [x] 1c. Blob metadata schema change + migration

### Phase 2: Innerworld Epic

- [x] Canvas viewport (api-xffr): service + routes
- [x] Region CRUD (api-arrz): service + routes
- [x] Entity CRUD (api-o8bs): service + routes

### Phase 3: Blob Epic

- [x] Presigned upload URL (api-0iu1): service + routes + lib
- [x] Upload confirmation + GET (api-jtka): service + routes
- [x] Download URL + DELETE + orphan cleanup (api-uixu): service + routes + lib

### Cross-cutting

- [x] Route mounting in systems/index.ts
- [x] Typecheck + lint pass
- [x] Tests pass

## Summary of Changes

### Phase 1: Shared Infrastructure

- Added 15 new audit event types for innerworld (region/entity/canvas) and blob operations
- Created validation schemas for innerworld (region, entity, canvas) and blob (upload URL, confirm)
- Modified blob_metadata schema: nullable checksum/uploadedAt, added createdAt/expiresAt for pending uploads
- Generated PG and SQLite migrations
- Updated existing tests for schema changes

### Phase 2: Innerworld Epic

- **Canvas service**: GET + PUT (upsert with OCC) at /systems/:systemId/innerworld/canvas
- **Region service**: Full CRUD with cascade archive, promote-on-restore, HAS_DEPENDENTS delete
- **Entity service**: Full CRUD with region FK validation, restore promotes if region archived

### Phase 3: Blob Epic

- **Upload URL**: POST /upload-url with per-purpose size limits, quota check, presigned URL generation
- **Confirm**: POST /:blobId/confirm with idempotent confirmation, pending-to-confirmed transition
- **Get**: GET /:blobId returns confirmed, non-archived blob metadata
- **Download URL**: GET /:blobId/download-url generates presigned download URL
- **Delete**: DELETE /:blobId archives blob (S3 cleanup deferred to BlobCleanupHandler)
- **Lib**: BlobUsageQueryImpl, OrphanBlobQueryImpl, BlobArchiverImpl, storage adapter singleton

### Cross-cutting

- Routes mounted at /systems/:systemId/innerworld and /systems/:systemId/blobs
- All services follow existing patterns (OCC, audit logging, assertSystemOwnership)
- Added @pluralscape/storage as API dependency
