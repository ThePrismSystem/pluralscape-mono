import { encrypt, getSodium } from "@pluralscape/crypto";

import { decryptWithDualKey } from "./dual-key-reader.js";

import type { CompletionItem, ItemProcessResult, RotationApiClient } from "./types.js";
import type { AeadKey } from "@pluralscape/crypto";
import type { BucketRotationItem } from "@pluralscape/types";

const MAX_ITEM_RETRIES = 3;
const BASE_DELAY_MS = 500;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/**
 * Process a chunk of rotation items: decrypt with old key, re-encrypt with new key.
 */
export async function processChunk(
  items: readonly BucketRotationItem[],
  apiClient: RotationApiClient,
  oldKey: AeadKey,
  oldKeyVersion: number,
  newKey: AeadKey,
  newKeyVersion: number,
  signal: AbortSignal,
): Promise<CompletionItem[]> {
  const results: CompletionItem[] = [];

  for (const item of items) {
    if (signal.aborted) break;

    const result = await processItem(item, apiClient, oldKey, oldKeyVersion, newKey, newKeyVersion);

    results.push({ itemId: item.id, status: result.status });
  }

  return results;
}

async function processItem(
  item: BucketRotationItem,
  apiClient: RotationApiClient,
  oldKey: AeadKey,
  oldKeyVersion: number,
  newKey: AeadKey,
  newKeyVersion: number,
): Promise<ItemProcessResult> {
  for (let attempt = 0; attempt < MAX_ITEM_RETRIES; attempt++) {
    try {
      // Fetch the entity blob
      const blob = await apiClient.fetchEntityBlob(item.entityType, item.entityId);

      // Already on new key version — skip re-encryption
      if (blob.keyVersion >= newKeyVersion) {
        return { item, status: "completed" };
      }

      // Decrypt with appropriate key
      const plaintext = decryptWithDualKey(
        blob.payload,
        blob.keyVersion,
        oldKey,
        oldKeyVersion,
        newKey,
        newKeyVersion,
      );

      // Re-encrypt with new key, then zero plaintext
      const encrypted = encrypt(plaintext, newKey);
      getSodium().memzero(plaintext);

      // Upload re-encrypted blob
      await apiClient.uploadReencrypted(item.entityType, item.entityId, encrypted, newKeyVersion);

      return { item, status: "completed" };
    } catch (error) {
      // On 404: entity deleted — mark completed
      if (isHttpError(error, HTTP_NOT_FOUND)) {
        return { item, status: "completed" };
      }

      // On 409: conflict from newer write — mark completed
      if (isHttpError(error, HTTP_CONFLICT)) {
        return { item, status: "completed" };
      }

      // Retry with exponential backoff
      if (attempt < MAX_ITEM_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  return { item, status: "failed" };
}

function isHttpError(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === status
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
