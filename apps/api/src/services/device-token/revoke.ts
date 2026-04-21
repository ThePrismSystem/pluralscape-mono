import { deviceTokens } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AuditEventType, DeviceTokenId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a device token was revoked. */
const AUDIT_TOKEN_REVOKED: AuditEventType = "device-token.revoked";

/** Revoke a device token by setting revokedAt. Returns 404 if not found or already revoked. */
export async function revokeDeviceToken(
  db: PostgresJsDatabase,
  systemId: SystemId,
  tokenId: DeviceTokenId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const timestamp = now();

    const [updated] = await tx
      .update(deviceTokens)
      .set({ revokedAt: timestamp })
      .where(
        and(
          eq(deviceTokens.id, tokenId),
          eq(deviceTokens.systemId, systemId),
          isNull(deviceTokens.revokedAt),
        ),
      )
      .returning({ id: deviceTokens.id });

    if (!updated) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Device token not found");
    }

    await audit(tx, {
      eventType: AUDIT_TOKEN_REVOKED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Device token revoked",
      accountId: auth.accountId,
      systemId,
    });
  });
}
