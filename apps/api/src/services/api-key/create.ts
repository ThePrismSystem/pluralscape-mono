import { randomBytes } from "node:crypto";

import { apiKeys } from "@pluralscape/db/pg";
import {
  API_KEY_TOKEN_PREFIX,
  ID_PREFIXES,
  brandId,
  createId,
  now,
  toUnixMillis,
} from "@pluralscape/types";
import { CreateApiKeyBodySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import {
  API_KEY_SELECT_COLUMNS,
  hashApiKeyToken,
  toApiKeyResult,
  type ApiKeyResult,
} from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiKeyId, BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ──────────────────────────────────────────────────────

/** Number of random bytes for API key token generation (32 bytes = 256-bit). */
const API_KEY_TOKEN_BYTES = 32;

// ── Types ──────────────────────────────────────────────────────────

/** Returned from create only -- includes the plaintext token for the caller to store. */
export interface ApiKeyCreateResult extends ApiKeyResult {
  readonly token: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Generate a cryptographically random API key token and its HMAC-SHA256 hash. */
async function generateTokenPair(): Promise<{ token: string; tokenHash: string }> {
  const raw = randomBytes(API_KEY_TOKEN_BYTES).toString("hex");
  const token = `${API_KEY_TOKEN_PREFIX}${raw}`;
  const tokenHash = await hashApiKeyToken(token);
  return { token, tokenHash };
}

// ── CREATE ─────────────────────────────────────────────────────────

export async function createApiKey(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ApiKeyCreateResult> {
  assertSystemOwnership(systemId, auth);

  const result = CreateApiKeyBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { keyType, scopes, encryptedData, encryptedKeyMaterial, expiresAt, scopedBucketIds } =
    result.data;

  const blob = validateEncryptedBlob(encryptedData);
  const akId = brandId<ApiKeyId>(createId(ID_PREFIXES.apiKey));
  const timestamp = now();
  const { token, tokenHash } = await generateTokenPair();

  const created = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(apiKeys)
      .values({
        id: akId,
        accountId: auth.accountId,
        systemId,
        keyType,
        tokenHash,
        scopes,
        encryptedData: blob,
        encryptedKeyMaterial: encryptedKeyMaterial
          ? Buffer.from(encryptedKeyMaterial, "base64")
          : null,
        createdAt: timestamp,
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: expiresAt !== undefined ? toUnixMillis(expiresAt) : null,
        scopedBucketIds: scopedBucketIds?.map((id) => brandId<BucketId>(id)) ?? null,
      })
      .returning(API_KEY_SELECT_COLUMNS);

    if (!row) {
      throw new Error("Failed to create API key -- INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "api-key.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "API key created",
      systemId,
    });

    return {
      ...toApiKeyResult(row),
      token,
    };
  });

  return created;
}
