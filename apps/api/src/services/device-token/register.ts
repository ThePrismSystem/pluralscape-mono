import { deviceTokens } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

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
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a device token was registered. */
const AUDIT_TOKEN_REGISTERED: AuditEventType = "device-token.registered";

/**
 * Register a device push token. Upserts on (token, platform) — if the same
 * token is re-registered, the lastActiveAt timestamp is refreshed.
 */
export async function registerDeviceToken(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: { readonly platform: DeviceTokenPlatform; readonly token: string },
  auth: AuthContext,
  audit: AuditWriter,
): Promise<DeviceTokenResult> {
  assertSystemOwnership(systemId, auth);

  const tokenHash = hashDeviceToken(params.token);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const timestamp = now();
    const id = brandId<DeviceTokenId>(createId(ID_PREFIXES.deviceToken));

    const [row] = await tx
      .insert(deviceTokens)
      .values({
        id,
        accountId: auth.accountId,
        systemId,
        platform: params.platform,
        tokenHash,
        createdAt: timestamp,
        lastActiveAt: timestamp,
      })
      .onConflictDoUpdate({
        target: [deviceTokens.tokenHash, deviceTokens.platform],
        set: {
          lastActiveAt: timestamp,
          revokedAt: null,
          systemId,
        },
        setWhere: eq(deviceTokens.accountId, auth.accountId),
      })
      .returning();

    if (!row) {
      // Conflict existed but accountId didn't match — token belongs to
      // another account. Silently no-op to avoid information leakage.
      return {
        id,
        systemId,
        platform: params.platform,
        tokenHash,
        lastActiveAt: timestamp as UnixMillis | null,
        createdAt: timestamp,
      } satisfies DeviceTokenResult;
    }

    await audit(tx, {
      eventType: AUDIT_TOKEN_REGISTERED,
      actor: { kind: "account", id: auth.accountId },
      detail: `Device token registered for platform ${params.platform}`,
      accountId: auth.accountId,
      systemId,
    });

    return toDeviceTokenResult(row);
  });
}
