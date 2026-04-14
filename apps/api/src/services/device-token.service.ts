import { deviceTokens } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { hashSessionToken } from "../lib/session-token.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import {
  DEFAULT_DEVICE_TOKEN_LIMIT,
  MAX_DEVICE_TOKENS_PER_LIST,
} from "./device-token.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AuditEventType,
  DeviceTokenId,
  DeviceTokenPlatform,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/** Audit event: a device token was registered. */
const AUDIT_TOKEN_REGISTERED: AuditEventType = "device-token.registered";

/** Audit event: a device token was updated. */
const AUDIT_TOKEN_UPDATED: AuditEventType = "device-token.updated";

/** Audit event: a device token was revoked. */
const AUDIT_TOKEN_REVOKED: AuditEventType = "device-token.revoked";

/** Audit event: a device token was deleted. */
const AUDIT_TOKEN_DELETED: AuditEventType = "device-token.deleted";

// ── Types ────────────────────────────────────────────────────────────

export interface DeviceTokenResult {
  readonly id: DeviceTokenId;
  readonly systemId: SystemId;
  readonly platform: DeviceTokenPlatform;
  readonly tokenHash: string;
  readonly lastActiveAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Hash a device token using BLAKE2b (same pattern as session tokens). */
export function hashDeviceToken(token: string): string {
  return hashSessionToken(token);
}

function toDeviceTokenResult(row: {
  id: string;
  systemId: string;
  platform: DeviceTokenPlatform;
  tokenHash: string;
  lastActiveAt: number | null;
  createdAt: number;
}): DeviceTokenResult {
  return {
    id: row.id as DeviceTokenId,
    systemId: row.systemId as SystemId,
    platform: row.platform,
    tokenHash: row.tokenHash,
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

  const tokenHash = hashDeviceToken(params.token);

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
  opts?: { cursor?: string; limit?: number },
): Promise<PaginatedResult<DeviceTokenResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_DEVICE_TOKEN_LIMIT, MAX_DEVICE_TOKENS_PER_LIST);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(deviceTokens.systemId, systemId), isNull(deviceTokens.revokedAt)];

    if (opts?.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "dt");
      const cursorCondition = or(
        lt(deviceTokens.createdAt, decoded.sortValue),
        and(eq(deviceTokens.createdAt, decoded.sortValue), lt(deviceTokens.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(deviceTokens)
      .where(and(...conditions))
      .orderBy(desc(deviceTokens.createdAt), desc(deviceTokens.id))
      .limit(limit + 1);

    return buildCompositePaginatedResult(
      rows,
      limit,
      (row) => toDeviceTokenResult(row),
      (item) => item.createdAt,
    );
  });
}
