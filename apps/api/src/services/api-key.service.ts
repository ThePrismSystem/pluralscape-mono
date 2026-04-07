import { createHmac, randomBytes } from "node:crypto";

import { accounts, apiKeys } from "@pluralscape/db/pg";
import {
  API_KEY_TOKEN_PREFIX,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { CreateApiKeyBodySchema } from "@pluralscape/validation";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

import { env } from "../env.js";
import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  ApiKeyId,
  ApiKeyScope,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ──────────────────────────────────────────────────────

/** Number of random bytes for API key token generation (32 bytes = 256-bit). */
const API_KEY_TOKEN_BYTES = 32;

/** Hex length of HMAC key (32 bytes = 64 hex characters). */
const HMAC_KEY_HEX_LENGTH = 64;

/**
 * Deterministic fallback HMAC key for dev/test when API_KEY_HMAC_KEY is unset.
 * In production, API_KEY_HMAC_KEY is required by env validation.
 */
const DEV_HMAC_KEY = "0".repeat(HMAC_KEY_HEX_LENGTH);

/** HMAC-SHA256 hash of an API key token for storage and lookup. */
function hashApiKeyToken(token: string): string {
  const key = env.API_KEY_HMAC_KEY ?? DEV_HMAC_KEY;
  return createHmac("sha256", key).update(token).digest("hex");
}

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
}

/** Returned from create only -- includes the plaintext token for the caller to store. */
export interface ApiKeyCreateResult extends ApiKeyResult {
  readonly token: string;
}

export interface ApiKeyListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  /** When true, include revoked keys in the listing. */
  readonly includeRevoked?: boolean;
}

// ── Shared select columns ──────────────────────────────────────────

const API_KEY_SELECT_COLUMNS = {
  id: apiKeys.id,
  systemId: apiKeys.systemId,
  keyType: apiKeys.keyType,
  scopes: apiKeys.scopes,
  createdAt: apiKeys.createdAt,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
  expiresAt: apiKeys.expiresAt,
  scopedBucketIds: apiKeys.scopedBucketIds,
} as const;

// ── Helpers ────────────────────────────────────────────────────────

function toApiKeyResult(row: {
  id: string;
  systemId: string;
  keyType: "metadata" | "crypto";
  scopes: readonly ApiKeyScope[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  expiresAt: number | null;
  scopedBucketIds: readonly string[] | null;
}): ApiKeyResult {
  return {
    id: row.id as ApiKeyId,
    systemId: row.systemId as SystemId,
    keyType: row.keyType,
    scopes: row.scopes,
    createdAt: toUnixMillis(row.createdAt),
    lastUsedAt: toUnixMillisOrNull(row.lastUsedAt),
    revokedAt: toUnixMillisOrNull(row.revokedAt),
    expiresAt: toUnixMillisOrNull(row.expiresAt),
    scopedBucketIds: row.scopedBucketIds,
  };
}

/** Generate a cryptographically random API key token and its HMAC-SHA256 hash. */
function generateTokenPair(): { token: string; tokenHash: string } {
  const raw = randomBytes(API_KEY_TOKEN_BYTES).toString("hex");
  const token = `${API_KEY_TOKEN_PREFIX}${raw}`;
  const tokenHash = hashApiKeyToken(token);
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
  const akId = createId(ID_PREFIXES.apiKey);
  const timestamp = now();
  const { token, tokenHash } = generateTokenPair();

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
        expiresAt: expiresAt ?? null,
        scopedBucketIds: scopedBucketIds ?? null,
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

// ── LIST ───────────────────────────────────────────────────────────

export async function listApiKeys(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ApiKeyListOptions = {},
): Promise<PaginatedResult<ApiKeyResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(apiKeys.systemId, systemId)];

    if (!opts.includeRevoked) {
      conditions.push(isNull(apiKeys.revokedAt));
    }

    if (opts.cursor) {
      conditions.push(lt(apiKeys.id, opts.cursor));
    }

    const rows = await tx
      .select(API_KEY_SELECT_COLUMNS)
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toApiKeyResult);
  });
}

// ── GET ────────────────────────────────────────────────────────────

export async function getApiKey(
  db: PostgresJsDatabase,
  systemId: SystemId,
  apiKeyId: ApiKeyId,
  auth: AuthContext,
): Promise<ApiKeyResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select(API_KEY_SELECT_COLUMNS)
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "API key not found");
    }

    return toApiKeyResult(row);
  });
}

// ── REVOKE ─────────────────────────────────────────────────────────

export async function revokeApiKey(
  db: PostgresJsDatabase,
  systemId: SystemId,
  apiKeyId: ApiKeyId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.systemId, systemId)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "API key not found");
    }

    // Idempotent: already revoked keys need no further action
    if (existing.revokedAt !== null) {
      return;
    }

    const timestamp = now();

    await tx
      .update(apiKeys)
      .set({ revokedAt: timestamp })
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.systemId, systemId)));

    await audit(tx, {
      eventType: "api-key.revoked",
      actor: { kind: "account", id: auth.accountId },
      detail: "API key revoked",
      systemId,
    });
  });
}

// ── VALIDATE ──────────────────────────────────────────────────────────

/** Result of API key validation — returned to auth middleware. */
export interface ValidateApiKeyResult {
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly scopes: readonly ApiKeyScope[];
  readonly auditLogIpTracking: boolean;
  readonly keyId: ApiKeyId;
}

/**
 * Validate an API key token and return the associated account and system.
 * Returns null if the key is invalid, revoked, or expired.
 */
export async function validateApiKey(
  db: PostgresJsDatabase,
  token: string,
): Promise<ValidateApiKeyResult | null> {
  const tokenHash = hashApiKeyToken(token);
  const currentTime = now();

  const [row] = await db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      systemId: apiKeys.systemId,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      auditLogIpTracking: accounts.auditLogIpTracking,
    })
    .from(apiKeys)
    .innerJoin(accounts, eq(accounts.id, apiKeys.accountId))
    .where(eq(apiKeys.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.revokedAt !== null) return null;
  if (row.expiresAt !== null && currentTime > row.expiresAt) return null;

  return {
    accountId: row.accountId as AccountId,
    systemId: row.systemId as SystemId,
    scopes: row.scopes,
    auditLogIpTracking: row.auditLogIpTracking,
    keyId: row.id as ApiKeyId,
  };
}
