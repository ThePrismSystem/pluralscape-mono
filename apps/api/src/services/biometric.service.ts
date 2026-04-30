import { GENERIC_HASH_BYTES_MAX, getSodium } from "@pluralscape/crypto";
import { biometricTokens, systemSettings } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { requireSession } from "../lib/auth-context.js";
import { toHex } from "../lib/hex.js";
import { withTenantTransaction } from "../lib/rls-context.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { BiometricTokenId } from "@pluralscape/types";
import type { BiometricEnrollBodySchema, BiometricVerifyBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

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
  body: z.infer<typeof BiometricEnrollBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<{ id: BiometricTokenId }> {
  const session = requireSession(auth);

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

    const tokenHash = hashToken(body.token);
    const id = brandId<BiometricTokenId>(createId(ID_PREFIXES.biometricToken));
    const timestamp = now();

    await tx.insert(biometricTokens).values({
      id,
      sessionId: session.sessionId,
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
  body: z.infer<typeof BiometricVerifyBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<{ verified: true }> {
  const session = requireSession(auth);

  if (!auth.systemId) {
    throw new ApiHttpError(
      HTTP_FORBIDDEN,
      "BIOMETRIC_DISABLED",
      "Biometric authentication requires an active system",
    );
  }

  const systemId = auth.systemId;
  const tokenHash = hashToken(body.token);

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [match] = await tx
      .update(biometricTokens)
      .set({ usedAt: now() })
      .where(
        and(
          eq(biometricTokens.sessionId, session.sessionId),
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
