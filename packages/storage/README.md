# @pluralscape/storage

Backend-agnostic blob storage adapter interface with S3 and filesystem implementations for encrypted media.

## Overview

`@pluralscape/storage` provides a uniform `BlobStorageAdapter` interface that decouples the application from any specific storage backend. Concrete adapters are shipped in sub-entry points (`/s3`, `/filesystem`) so each deployment tier can import only what it needs. An in-memory adapter (`src/adapters/memory-adapter.ts`) backs the contract test suite and is not part of the public export surface.

All bytes flowing through the adapter are encrypted before they arrive. The storage layer is zero-knowledge: it stores and retrieves opaque ciphertext and never has access to plaintext media. Per ADR 009, the client encrypts blobs (XChaCha20-Poly1305) before upload, and decrypts them locally after download. The server generates time-limited presigned URLs so clients upload directly to the storage backend, keeping API server bandwidth low.

Quota management and orphan-blob cleanup are provided via the `/quota` sub-entry point. These utilities run server-side and operate on storage-key metadata, not on blob contents.

## Key Exports

### Root entry point (`@pluralscape/storage`)

**Interface and types**

| Export                    | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `BlobStorageAdapter`      | Core adapter interface — all backends implement this                                 |
| `BlobUploadParams`        | Parameters for `adapter.upload()`                                                    |
| `PresignedUploadParams`   | Parameters for `adapter.generatePresignedUploadUrl()`                                |
| `PresignedDownloadParams` | Parameters for `adapter.generatePresignedDownloadUrl()`                              |
| `PresignedUrlResult`      | Discriminated union: `{ supported: true; url; expiresAt }` or `{ supported: false }` |
| `StoredBlobMetadata`      | Metadata returned after a successful upload                                          |

**Error classes**

| Export                   | Thrown when                                              |
| ------------------------ | -------------------------------------------------------- |
| `BlobNotFoundError`      | `download()` or `getMetadata()` called for a missing key |
| `BlobAlreadyExistsError` | `upload()` called for a key that already exists          |
| `BlobTooLargeError`      | Uploaded data exceeds the adapter's size limit           |
| `QuotaExceededError`     | Upload would exceed a system's storage quota             |
| `StorageBackendError`    | Unexpected backend error                                 |

**Utilities**

| Export                                 | Description                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `generateStorageKey(systemId, blobId)` | Builds a `{systemId}/{blobId}` storage key                                  |
| `parseStorageKey(key)`                 | Splits a key back into `{ systemId, blobId }`, or `null` on malformed input |

### `/s3` — S3-compatible adapter

```ts
import { S3BlobStorageAdapter } from "@pluralscape/storage/s3";
import type { S3AdapterConfig } from "@pluralscape/storage/s3";
```

Works against AWS S3, Cloudflare R2, Backblaze B2, or MinIO. Supports presigned upload and download URLs, configurable `maxSizeBytes` enforcement (throws `BlobTooLargeError` on over-sized `upload()`), and write-once semantics via `If-None-Match: *` baked into both direct PUTs and presigned URLs. Presigned uploads sign `content-length`, `content-type`, and `if-none-match` into the signature so clients cannot override them at upload time — this is required for MinIO and some S3-compatible backends that do not auto-sign those headers.

### `/filesystem` — Local filesystem adapter

```ts
import { FilesystemBlobStorageAdapter } from "@pluralscape/storage/filesystem";
```

Minimal self-hosted fallback. Stores blobs in a configurable directory with atomic temp-file + link writes and optional `maxSizeBytes` enforcement. Does not support presigned URLs (`supportsPresignedUrls` is `false`); the API server proxies uploads and downloads directly. Accepts an optional `logger` for structured observability (e.g. sidecar parse failures).

### `/quota` — Quota and cleanup utilities

```ts
import {
  BlobQuotaService,
  createQuotaService,
  OrphanBlobDetector,
  BlobCleanupHandler,
  DEFAULT_QUOTA_BYTES,
  DEFAULT_GRACE_PERIOD_MS,
} from "@pluralscape/storage/quota";
```

`BlobQuotaService` exposes `getUsage`, `checkQuota`, `assertQuota`, and `reserveQuota` for per-system enforcement before writes. `reserveQuota` is the advisory-lock integration point — it is equivalent to `assertQuota` today and is subject to TOCTOU races until the API layer wraps reserve + upload in a serializable transaction with `pg_advisory_xact_lock`. `OrphanBlobDetector` identifies blobs whose metadata records have been deleted (with a configurable grace period, 24 h by default). `BlobCleanupHandler` drives the archival and removal job; per-key failures are isolated and reported in `CleanupResult.failedKeys` without aborting the run.

## Usage

### Presigned upload flow (S3 / MinIO)

```ts
import { S3BlobStorageAdapter } from "@pluralscape/storage/s3";
import { generateStorageKey, BlobTooLargeError, QuotaExceededError } from "@pluralscape/storage";

const adapter = new S3BlobStorageAdapter({
  bucket: "pluralscape-media",
  region: "us-east-1",
  // endpoint: "http://localhost:9000", // MinIO
});

const storageKey = generateStorageKey(systemId, blobId);

// Generate a presigned URL for the client to upload directly.
// `sizeBytes` MUST be the exact on-the-wire body length — i.e. the
// ciphertext length, never the plaintext size. The value is signed into
// the request as a `Content-Length` constraint; a mismatch at upload
// time yields HTTP 403 `SignatureDoesNotMatch` from S3.
const result = await adapter.generatePresignedUploadUrl({
  storageKey,
  mimeType: "image/webp",
  sizeBytes: encryptedBytes.length,
  expiresInMs: 5 * 60 * 1_000, // 5 minutes
});

if (result.supported) {
  // Client POSTs encrypted bytes directly to result.url — server never sees them
  console.log("Upload to:", result.url, "— expires at:", result.expiresAt);
} else {
  // Filesystem adapter: proxy through the API server instead
}
```

### Checking adapter capability at runtime

```ts
if (!adapter.supportsPresignedUrls) {
  // Fall back to proxied upload via API
}
```

## Dependencies

| Package                         | Purpose                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `@aws-sdk/client-s3`            | S3 API client (upload, download, metadata)                      |
| `@aws-sdk/s3-request-presigner` | Presigned URL generation                                        |
| `@pluralscape/types`            | Branded types: `StorageKey`, `SystemId`, `BlobId`, `UnixMillis` |

## Testing

```bash
# Unit tests
pnpm vitest run --project storage

# Integration tests (requires S3-compatible backend)
pnpm vitest run --project storage-integration
```

Integration tests exercise real I/O against a running storage backend. See `packages/storage/src/__tests__/` for setup requirements.
