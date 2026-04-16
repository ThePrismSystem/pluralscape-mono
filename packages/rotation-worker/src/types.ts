import type { AeadKey, EncryptedPayload } from "@pluralscape/crypto";
import type {
  BucketId,
  BucketKeyRotation,
  BucketRotationItem,
  ChunkClaimResponse,
  ChunkCompletionResponse,
  EntityType,
} from "@pluralscape/types";

/** Encrypted payload with key version metadata. */
export interface VersionedEncryptedPayload {
  readonly payload: EncryptedPayload;
  readonly keyVersion: number;
}

/** Completion item reported back to the server. */
export interface CompletionItem {
  readonly itemId: string;
  readonly status: "completed" | "failed";
}

/** API client interface — implemented by the mobile/web app using its HTTP layer. */
export interface RotationApiClient {
  claimChunk(
    bucketId: BucketId,
    rotationId: string,
    chunkSize: number,
  ): Promise<ChunkClaimResponse>;
  completeChunk(
    bucketId: BucketId,
    rotationId: string,
    items: CompletionItem[],
  ): Promise<ChunkCompletionResponse>;
  getProgress(bucketId: BucketId, rotationId: string): Promise<BucketKeyRotation>;
  fetchEntityBlob(entityType: EntityType, entityId: string): Promise<VersionedEncryptedPayload>;
  uploadReencrypted(
    entityType: EntityType,
    entityId: string,
    payload: EncryptedPayload,
    keyVersion: number,
  ): Promise<void>;
}

/** Minimal sodium adapter for key zeroing. */
export interface RotationSodium {
  memzero(buf: Uint8Array): void;
}

/** Configuration for the rotation worker. */
export interface RotationWorkerConfig {
  readonly apiClient: RotationApiClient;
  readonly bucketId: BucketId;
  readonly rotationId: string;
  readonly oldKey: AeadKey;
  readonly oldKeyVersion: number;
  readonly newKey: AeadKey;
  readonly newKeyVersion: number;
  readonly chunkSize?: number;
  readonly sodium: RotationSodium;
}

/** Status callback for progress reporting. */
export type RotationProgressCallback = (rotation: BucketKeyRotation) => void;

/** Result of processing a single item. */
export interface ItemProcessResult {
  readonly item: BucketRotationItem;
  readonly status: "completed" | "failed";
  /** Present when status is "failed" — the error message from the last retry attempt. */
  readonly failureReason?: string;
}
