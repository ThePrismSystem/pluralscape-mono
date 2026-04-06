# @pluralscape/rotation-worker

Client-side incremental re-encryption worker for privacy bucket key rotation.

## Overview

When a friend is removed from a privacy bucket, Pluralscape immediately revokes their API access and generates a new bucket key. All data previously encrypted under the old key must then be re-encrypted under the new key. This package implements that re-encryption process on the client, following the lazy rotation protocol specified in [ADR 014](../../docs/adr/014-lazy-key-rotation.md).

Re-encryption proceeds in chunks. The worker claims a batch of items from the server-side rotation ledger, fetches each entity blob, decrypts it with the old key, re-encrypts it with the new key, uploads the result, and reports completion. The server never sees key material. Multiple devices owned by the same system can work concurrently — each claims independent chunks, and stale claims are automatically reclaimed after five minutes.

The worker is resumable across sessions. If the device goes offline mid-rotation, progress is preserved in the server ledger. On the next session the worker picks up from where it left off. A 404 response on the rotation resource (rotation deleted or cancelled) causes the worker to stop gracefully. Per-item 404 (entity deleted) and 409 (version conflict from a concurrent newer write) are treated as successful completion of that item.

## Key Exports

### `RotationWorker`

The main class. Instantiate with a `RotationWorkerConfig` and an optional progress callback, then call `start()`. Call `stop()` to abort gracefully at the next chunk boundary.

```ts
class RotationWorker {
  constructor(config: RotationWorkerConfig, onProgress?: RotationProgressCallback);
  get isRunning(): boolean;
  start(): Promise<void>;
  stop(): void;
}
```

### `decryptWithDualKey`

Selects the correct key based on `keyVersion` and decrypts a blob. Throws `DecryptionFailedError` if the version matches neither key — fails closed rather than guessing.

```ts
function decryptWithDualKey(
  payload: EncryptedPayload,
  keyVersion: number,
  oldKey: AeadKey,
  oldKeyVersion: number,
  newKey: AeadKey,
  newKeyVersion: number,
): Uint8Array;
```

### `processChunk`

Processes a slice of `BucketRotationItem` records: fetches each blob, decrypts with the appropriate key, re-encrypts with the new key, and uploads. Retries each item up to three times with exponential backoff before marking it failed. Respects the abort signal.

```ts
function processChunk(
  items: readonly BucketRotationItem[],
  apiClient: RotationApiClient,
  oldKey: AeadKey,
  oldKeyVersion: number,
  newKey: AeadKey,
  newKeyVersion: number,
  signal: AbortSignal,
): Promise<CompletionItem[]>;
```

### Types

| Type                        | Description                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `RotationWorkerConfig`      | Worker configuration: bucket ID, rotation ID, old/new keys and versions, chunk size, API client |
| `RotationApiClient`         | Interface the app must implement to connect the worker to its HTTP layer                        |
| `RotationProgressCallback`  | `(rotation: BucketKeyRotation) => void` — called after each chunk completes                     |
| `VersionedEncryptedPayload` | Encrypted blob with its `keyVersion` metadata                                                   |
| `CompletionItem`            | Per-item result (`completed` or `failed`) reported back to the server                           |
| `ItemProcessResult`         | Internal per-item result carrying the original `BucketRotationItem`                             |

## Usage

```ts
import { RotationWorker } from "@pluralscape/rotation-worker";
import type { RotationApiClient, RotationWorkerConfig } from "@pluralscape/rotation-worker";

// Implement RotationApiClient using your app's HTTP layer
const apiClient: RotationApiClient = {
  /* ... */
};

const config: RotationWorkerConfig = {
  apiClient,
  bucketId: "bucket_abc123",
  rotationId: "rot_xyz789",
  oldKey: fetchedOldKey,
  oldKeyVersion: 1,
  newKey: fetchedNewKey,
  newKeyVersion: 2,
  chunkSize: 50, // optional, defaults to KEY_ROTATION.defaultChunkSize
};

const worker = new RotationWorker(config, (rotation) => {
  console.log(`Progress: ${rotation.completedItems}/${rotation.totalItems}`);
});

await worker.start(); // resolves when all items are processed or rotation completes/fails
```

To stop early (e.g., app backgrounding):

```ts
worker.stop();
```

## Dependencies

| Package               | Role                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pluralscape/crypto` | `encrypt`, `decrypt`, `AeadKey`, `EncryptedPayload`, `DecryptionFailedError`                                                                   |
| `@pluralscape/types`  | `BucketId`, `BucketKeyRotation`, `BucketRotationItem`, `ChunkClaimResponse`, `ChunkCompletionResponse`, `EntityType`, `KEY_ROTATION` constants |

## Testing

Unit tests only (no integration variant — the worker is a pure client-side state machine that depends on an injected `RotationApiClient`).

```bash
pnpm vitest run --project rotation-worker
```

Tests cover: full rotation loop (single and multi-chunk), early exit when chunk is empty or rotation transitions to `completed`/`failed`, graceful stop via `abort`, 404 on the rotation resource, per-item retry with exponential backoff, per-item 404 and 409 short-circuit, dual-key selection by version, unknown key version rejection, and abort mid-chunk.
