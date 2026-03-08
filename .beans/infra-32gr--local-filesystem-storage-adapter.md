---
# infra-32gr
title: Local filesystem storage adapter
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:58:17Z
updated_at: 2026-03-08T19:58:17Z
parent: infra-o80c
blocked_by:
  - infra-psh9
---

Local filesystem storage adapter for minimal self-hosted deployments.

## Scope

- Implement BlobStorage interface using local filesystem directory
- Configurable storage root path (default: `./data/blobs/`)
- Directory structure: `{storageRoot}/{accountId}/{blobId}` for isolation
- API server handles upload/download directly (no presigned URLs)
- Streaming upload/download to avoid memory pressure on large files
- File permissions: restrict to application user only
- Quota enforcement: check directory size before accepting uploads
- Cleanup: garbage collection for orphaned blobs (metadata deleted but file remains)
- No external dependencies — works with single-binary deployment

## Acceptance Criteria

- [ ] BlobStorage interface implemented for local filesystem
- [ ] Configurable storage root directory
- [ ] Account-isolated directory structure
- [ ] Streaming upload and download
- [ ] File permission restrictions
- [ ] Quota enforcement via directory size check
- [ ] Orphaned blob cleanup
- [ ] Unit tests for path construction and isolation
- [ ] Integration test: upload, download, delete cycle

## References

- ADR 009 (Blob Storage — local filesystem fallback)
- ADR 012 (Self-Hosted Tiers — minimal tier)
