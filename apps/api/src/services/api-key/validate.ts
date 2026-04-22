import { accounts, apiKeys } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { hashApiKeyToken } from "./internal.js";

import type { AccountId, ApiKeyId, ApiKeyScope, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ──────────────────────────────────────────────────────────

/** Result of API key validation — returned to auth middleware. */
export interface ValidateApiKeyResult {
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly scopes: readonly ApiKeyScope[];
  readonly auditLogIpTracking: boolean;
  readonly keyId: ApiKeyId;
}

// ── VALIDATE ──────────────────────────────────────────────────────────

/**
 * Validate an API key token and return the associated account and system.
 * Returns null if the key is invalid, revoked, or expired.
 */
export async function validateApiKey(
  db: PostgresJsDatabase,
  token: string,
): Promise<ValidateApiKeyResult | null> {
  const tokenHash = await hashApiKeyToken(token);
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
    accountId: brandId<AccountId>(row.accountId),
    systemId: brandId<SystemId>(row.systemId),
    scopes: row.scopes,
    auditLogIpTracking: row.auditLogIpTracking,
    keyId: brandId<ApiKeyId>(row.id),
  };
}
