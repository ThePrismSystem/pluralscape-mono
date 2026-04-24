import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import {
  CACHE_DOMAINS,
  FIELD_DEFINITIONS_CACHE_TTL_MS,
  buildCacheKey,
} from "../../lib/cache.constants.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import { QueryCache } from "../../lib/query-cache.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  FieldDefinitionId,
  FieldDefinitionServerMetadata,
  FieldType,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";

// ── Constants ───────────────────────────────────────────────────────

/** Maximum size of encrypted field definition data in bytes after base64 decode (32 KiB). */
const MAX_ENCRYPTED_FIELD_DATA_BYTES = 32_768;

// ── Types ───────────────────────────────────────────────────────────

export type FieldDefinitionResult = EncryptedWire<FieldDefinitionServerMetadata>;

// ── Cache ───────────────────────────────────────────────────────────

/**
 * Cache for field definition list results, keyed by `systemId:cursor:limit:includeArchived`.
 * Invalidated on any write operation (create, update, archive, restore, delete).
 */
export const fieldDefCache = new QueryCache<PaginatedResult<FieldDefinitionResult>>(
  FIELD_DEFINITIONS_CACHE_TTL_MS,
);

/** Build a cache key for list queries. */
export function listCacheKey(
  systemId: SystemId,
  cursor?: string,
  limit?: number,
  includeArchived?: boolean,
): string {
  return buildCacheKey(
    systemId,
    CACHE_DOMAINS.fieldDefinition,
    cursor ?? "",
    String(limit ?? ""),
    String(includeArchived ?? false),
  );
}

/** Invalidate all cached list results (clears entire cache on any write). */
export function invalidateFieldDefCache(): void {
  fieldDefCache.clear();
}

/** Exported for test teardown. */
export function clearFieldDefCache(): void {
  fieldDefCache.clear();
}

// ── Helpers ─────────────────────────────────────────────────────────

export function toFieldDefinitionResult(row: {
  id: string;
  systemId: string;
  fieldType: string;
  required: boolean;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): FieldDefinitionResult {
  return {
    id: brandId<FieldDefinitionId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    fieldType: row.fieldType as FieldType,
    required: row.required,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

export function parseAndValidateFieldBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_FIELD_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_FIELD_DATA_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}
