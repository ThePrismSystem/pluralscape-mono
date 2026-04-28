import { createHmac } from "node:crypto";

import { apiKeys } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { env } from "../../env.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  ApiKeyId,
  ApiKeyScope,
  EncryptedBase64,
  EncryptedBlob,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Types ──────────────────────────────────────────────────────────

export interface ApiKeyResult {
  readonly id: ApiKeyId;
  readonly systemId: SystemId;
  readonly keyType: "metadata" | "crypto";
  readonly scopes: readonly ApiKeyScope[];
  readonly createdAt: UnixMillis;
  readonly lastUsedAt: UnixMillis | null;
  readonly revokedAt: UnixMillis | null;
  readonly expiresAt: UnixMillis | null;
  readonly scopedBucketIds: readonly string[] | null;
  /**
   * Base64-encoded T1 ciphertext blob carrying the `ApiKeyEncryptedPayload`
   * (name plus, for crypto variants, the X25519 publicKey). Decrypted
   * client-side via `decryptApiKeyPayload` from `@pluralscape/data`.
   */
  readonly encryptedData: EncryptedBase64;
}

// ── Shared select columns ──────────────────────────────────────────

export const API_KEY_SELECT_COLUMNS = {
  id: apiKeys.id,
  systemId: apiKeys.systemId,
  keyType: apiKeys.keyType,
  scopes: apiKeys.scopes,
  createdAt: apiKeys.createdAt,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
  expiresAt: apiKeys.expiresAt,
  scopedBucketIds: apiKeys.scopedBucketIds,
  encryptedData: apiKeys.encryptedData,
} as const;

// ── Helpers ────────────────────────────────────────────────────────

export function toApiKeyResult(row: {
  id: string;
  systemId: string;
  keyType: "metadata" | "crypto";
  scopes: readonly ApiKeyScope[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  expiresAt: number | null;
  scopedBucketIds: readonly string[] | null;
  encryptedData: EncryptedBlob;
}): ApiKeyResult {
  return {
    id: brandId<ApiKeyId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    keyType: row.keyType,
    scopes: row.scopes,
    createdAt: toUnixMillis(row.createdAt),
    lastUsedAt: toUnixMillisOrNull(row.lastUsedAt),
    revokedAt: toUnixMillisOrNull(row.revokedAt),
    expiresAt: toUnixMillisOrNull(row.expiresAt),
    scopedBucketIds: row.scopedBucketIds,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
  };
}

async function getHmacKey(): Promise<string> {
  if (env.API_KEY_HMAC_KEY !== undefined) {
    return env.API_KEY_HMAC_KEY;
  }
  if (process.env["NODE_ENV"] !== "production") {
    // Zod refines in env.ts guarantee env.API_KEY_HMAC_KEY is defined in
    // production, so this branch is dev-only. The explicit NODE_ENV guard
    // lets the bundler statically drop the dynamic import and its string
    // literals from the production bundle.
    const { DEV_HMAC_KEY } = await import("../../lib/dev-constants.js");
    return DEV_HMAC_KEY;
  }
  // Should never reach here — Zod refines in env.ts guarantee
  // API_KEY_HMAC_KEY is set in production.
  throw new Error("API_KEY_HMAC_KEY is required in production");
}

/** HMAC-SHA256 hash of an API key token for storage and lookup. */
export async function hashApiKeyToken(token: string): Promise<string> {
  const key = await getHmacKey();
  return createHmac("sha256", key).update(token).digest("hex");
}
