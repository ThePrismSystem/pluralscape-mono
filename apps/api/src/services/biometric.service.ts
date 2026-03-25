import { GENERIC_HASH_BYTES_MAX, getSodium } from "@pluralscape/crypto";
import { biometricTokens, systemSettings } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { BiometricEnrollBodySchema, BiometricVerifyBodySchema } from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { toHex } from "../lib/hex.js";
import { withTenantTransaction } from "../lib/rls-context.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { BiometricTokenId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Helpers ─────────────────────────────────────────────────────────

function hashToken(token: string): string {
  const adapter = getSodium();
  const tokenBytes = new TextEncoder().encode(token);
  try {
    const hash = adapter.genericHash(GENERIC_HASH_BYTES_MAX, tokenBytes);
    return toHex(hash);
  } finally {
    adapter.memzero(tokenBytes);
  }
}

// ── Enroll ──────────────────────────────────────────────────────────

export async function enrollBiometric(
  db: PostgresJsDatabase,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<{ id: BiometricTokenId }> {
  const parsed = BiometricEnrollBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid enroll payload");
  }

  // Guard: biometric must be enabled in system settings
  if (!auth.systemId) {
    throw new ApiHttpError(
      HTTP_FORBIDDEN,
      "BIOMETRIC_DISABLED",
      "Biometric authentication requires an active system",
    );
  }

  const systemId = auth.systemId;

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [settings] = await tx
      .select({ biometricEnabled: systemSettings.biometricEnabled })
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1);

    if (!settings?.biometricEnabled) {
      throw new ApiHttpError(
        HTTP_FORBIDDEN,
        "BIOMETRIC_DISABLED",
        "Biometric authentication is not enabled for this system",
      );
    }

    const tokenHash = hashToken(parsed.data.token);
    const id = createId(ID_PREFIXES.biometricToken) as BiometricTokenId;
    const timestamp = now();

    await tx.insert(biometricTokens).values({
      id,
      sessionId: auth.sessionId,
      tokenHash,
      createdAt: timestamp,
    });

    await audit(tx, {
      eventType: "auth.biometric-enrolled",
      actor: { kind: "account", id: auth.accountId },
      detail: "Biometric token enrolled",
      systemId,
    });

    return { id };
  });
}

// ── Verify ──────────────────────────────────────────────────────────

export async function verifyBiometric(
  db: PostgresJsDatabase,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<{ verified: true }> {
  const parsed = BiometricVerifyBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid verify payload");
  }

  if (!auth.systemId) {
    throw new ApiHttpError(
      HTTP_FORBIDDEN,
      "BIOMETRIC_DISABLED",
      "Biometric authentication requires an active system",
    );
  }

  const systemId = auth.systemId;
  const tokenHash = hashToken(parsed.data.token);

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [match] = await tx
      .update(biometricTokens)
      .set({ usedAt: now() })
      .where(
        and(
          eq(biometricTokens.sessionId, auth.sessionId),
          eq(biometricTokens.tokenHash, tokenHash),
          isNull(biometricTokens.usedAt),
        ),
      )
      .returning({ id: biometricTokens.id });

    if (!match) {
      await audit(tx, {
        eventType: "auth.biometric-failed",
        actor: { kind: "account", id: auth.accountId },
        detail: "Biometric verification failed",
        systemId,
      });
      return { verified: false } as const;
    }

    await audit(tx, {
      eventType: "auth.biometric-verified",
      actor: { kind: "account", id: auth.accountId },
      detail: "Biometric token verified",
      systemId,
    });

    return { verified: true } as const;
  });

  if (!result.verified) {
    throw new ApiHttpError(HTTP_UNAUTHORIZED, "INVALID_TOKEN", "Biometric token is invalid");
  }
  return { verified: true };
}
