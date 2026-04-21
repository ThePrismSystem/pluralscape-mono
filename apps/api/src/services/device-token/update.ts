import { deviceTokens } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { hashDeviceToken, toDeviceTokenResult } from "./internal.js";

import type { DeviceTokenResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AuditEventType,
  DeviceTokenId,
  DeviceTokenPlatform,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a device token was updated. */
const AUDIT_TOKEN_UPDATED: AuditEventType = "device-token.updated";

/** Update a device token's platform or token value. Only non-revoked tokens can be updated. */
export async function updateDeviceToken(
  db: PostgresJsDatabase,
  systemId: SystemId,
  tokenId: DeviceTokenId,
  params: { readonly platform?: DeviceTokenPlatform; readonly token?: string },
  auth: AuthContext,
  audit: AuditWriter,
): Promise<DeviceTokenResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const timestamp = now();

    const [row] = await tx
      .update(deviceTokens)
      .set({
        lastActiveAt: timestamp,
        ...(params.platform !== undefined && { platform: params.platform }),
        ...(params.token !== undefined && { tokenHash: hashDeviceToken(params.token) }),
      })
      .where(
        and(
          eq(deviceTokens.id, tokenId),
          eq(deviceTokens.systemId, systemId),
          isNull(deviceTokens.revokedAt),
        ),
      )
      .returning();

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Device token not found");
    }

    await audit(tx, {
      eventType: AUDIT_TOKEN_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Device token updated",
      accountId: auth.accountId,
      systemId,
    });

    return toDeviceTokenResult(row);
  });
}
