import { deviceTokens } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, desc, eq, isNull } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AuditEventType,
  DeviceTokenId,
  DeviceTokenPlatform,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/** Audit event: a device token was registered. */
const AUDIT_TOKEN_REGISTERED: AuditEventType = "device-token.registered";

/** Audit event: a device token was revoked. */
const AUDIT_TOKEN_REVOKED: AuditEventType = "device-token.revoked";

/** Maximum number of device tokens returned per list request. */
const MAX_DEVICE_TOKENS_PER_LIST = 100;

/** Number of trailing characters to show in masked token strings. */
const TOKEN_MASK_VISIBLE_CHARS = 8;

// ── Types ────────────────────────────────────────────────────────────

export interface DeviceTokenResult {
  readonly id: DeviceTokenId;
  readonly systemId: SystemId;
  readonly platform: DeviceTokenPlatform;
  readonly token: string;
  readonly lastActiveAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}

// ── Helpers ──────────────────────────────────────────────────────────

function toDeviceTokenResult(row: {
  id: string;
  systemId: string;
  platform: DeviceTokenPlatform;
  token: string;
  lastActiveAt: number | null;
  createdAt: number;
}): DeviceTokenResult {
  return {
    id: row.id as DeviceTokenId,
    systemId: row.systemId as SystemId,
    platform: row.platform,
    token: row.token,
    lastActiveAt: (row.lastActiveAt ?? null) as UnixMillis | null,
    createdAt: row.createdAt as UnixMillis,
  };
}

// ── Service functions ────────────────────────────────────────────────

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

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const timestamp = now();
    const id = createId(ID_PREFIXES.deviceToken) as DeviceTokenId;

    const [row] = await tx
      .insert(deviceTokens)
      .values({
        id,
        accountId: auth.accountId,
        systemId,
        platform: params.platform,
        token: params.token,
        createdAt: timestamp,
        lastActiveAt: timestamp,
      })
      .onConflictDoUpdate({
        target: [deviceTokens.token, deviceTokens.platform],
        set: {
          accountId: auth.accountId,
          systemId,
          lastActiveAt: timestamp,
          revokedAt: null,
        },
      })
      .returning();

    if (!row) {
      throw new Error("Device token insert returned no rows");
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

/** List all non-revoked device tokens for a system, newest first. */
export async function listDeviceTokens(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<readonly DeviceTokenResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select()
      .from(deviceTokens)
      .where(and(eq(deviceTokens.systemId, systemId), isNull(deviceTokens.revokedAt)))
      .orderBy(desc(deviceTokens.createdAt))
      .limit(MAX_DEVICE_TOKENS_PER_LIST);

    return rows.map((row) => {
      const result = toDeviceTokenResult(row);
      return {
        ...result,
        token:
          result.token.length > TOKEN_MASK_VISIBLE_CHARS
            ? `***${result.token.slice(-TOKEN_MASK_VISIBLE_CHARS)}`
            : result.token,
      };
    });
  });
}
