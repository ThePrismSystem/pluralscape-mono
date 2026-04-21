import { apiKeys } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiKeyId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
