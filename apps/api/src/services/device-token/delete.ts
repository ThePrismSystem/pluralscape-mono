import { deviceTokens } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AuditEventType, DeviceTokenId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a device token was deleted. */
const AUDIT_TOKEN_DELETED: AuditEventType = "device-token.deleted";

/** Delete a device token permanently. Returns 404 if not found. */
export async function deleteDeviceToken(
  db: PostgresJsDatabase,
  systemId: SystemId,
  tokenId: DeviceTokenId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.id, tokenId), eq(deviceTokens.systemId, systemId)))
      .returning({ id: deviceTokens.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Device token not found");
    }

    await audit(tx, {
      eventType: AUDIT_TOKEN_DELETED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Device token deleted",
      accountId: auth.accountId,
      systemId,
    });
  });
}
