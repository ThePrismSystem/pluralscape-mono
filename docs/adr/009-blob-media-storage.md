# ADR 009: Blob/Media Storage — S3-Compatible with Client-Side Encryption

## Status

Accepted

## Context

Pluralscape stores user-uploaded media: avatars, multi-photo galleries, group images, littles safe mode content (links, videos, images), and import archives (SP avatar ZIPs). The storage layer must support:

- E2E encryption — media encrypted client-side before upload, server stores opaque blobs
- Thumbnailing — preview images for galleries and avatars without downloading full-size originals
- Self-hosting without mandatory cloud services
- Quotas and retention policies
- Efficient image delivery on mobile (low-spec devices, metered connections)
- Image editing — crop and resize before upload (no external tool required)

PostgreSQL/SQLite are unsuitable for blob storage at scale (bloated databases, backup complexity, no streaming).

Evaluated: S3-compatible object storage, PostgreSQL large objects, SQLite BLOB columns, filesystem-only.

## Decision

**S3-compatible object storage** for all media, with **MinIO** as the self-hosted option and **local filesystem** as a minimal fallback.

### Storage pipeline

1. User selects/captures an image → client offers crop/resize UI
2. Client generates a thumbnail (separate blob)
3. Client encrypts both full-size and thumbnail with the appropriate key (tier 1 for private, bucket key for shared)
4. Client uploads encrypted blobs to S3-compatible storage via presigned URLs
5. Server stores a metadata record (object key, size, content type, encryption metadata) — never the plaintext
6. On retrieval: client downloads encrypted blob → decrypts → displays

### Deployment tiers

| Tier                  | Backend                                               | Notes                                       |
| --------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Hosted                | Any S3 provider (AWS S3, Cloudflare R2, Backblaze B2) | Standard presigned URL flow                 |
| Self-hosted (full)    | MinIO container in Docker Compose                     | S3-compatible API, single container         |
| Self-hosted (minimal) | Local filesystem                                      | Bun serves files directly, no S3 dependency |

### Key design decisions

- **Client-side encryption only** — the server and storage backend never see plaintext media. This means no server-side image processing, transcoding, or CDN caching of readable images.
- **Thumbnails are separate encrypted blobs** — generated client-side at upload time. Avoids downloading multi-MB images for list views.
- **Presigned URLs for upload/download** — the API server generates time-limited S3 URLs. The client uploads directly to storage, reducing API server bandwidth.
- **Local filesystem fallback** — for minimal self-hosted deployments, blobs are stored in a configurable directory. The API server handles uploads/downloads directly (no presigned URLs).

### Why MinIO

- S3-compatible API — same client code works against any S3 provider or MinIO
- Single binary / single container deployment
- AGPL-3.0 licensed — same license as Pluralscape
- Battle-tested, Linux Foundation CNCF project
- Supports bucket policies, lifecycle rules, and quotas

## Consequences

- No server-side image processing — all crop/resize/thumbnail work happens on the client, which increases client complexity and may be slow on low-spec devices
- Encrypted blobs cannot be CDN-cached in readable form — cache only the encrypted bytes, decryption happens on-device
- Local filesystem fallback lacks the durability guarantees of S3 — self-hosters using minimal tier should configure their own backup strategy
- Three storage backends increase testing surface (S3, MinIO, local filesystem)
- Import of SP avatar ZIPs requires client-side extraction, encryption, and upload of potentially hundreds of images — must be chunked with progress indication

### License

MinIO: AGPL-3.0 (compatible, same license). AWS SDK: Apache 2.0 (compatible).
