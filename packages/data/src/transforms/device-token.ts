import type { DeviceToken } from "@pluralscape/types";

// ── Wire types ────────────────────────────────────────────────────────

/**
 * Wire shape returned by `deviceToken.get` — identical to `DeviceToken`.
 * Device tokens have no archive variant; records are deleted, not archived.
 */
export type DeviceTokenRaw = DeviceToken;

/** Shape returned by `deviceToken.list`. */
export interface DeviceTokenPage {
  readonly data: readonly DeviceTokenRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Narrow a single device token API result into a `DeviceToken`.
 * This is a passthrough — device tokens have no archive variant.
 */
export function narrowDeviceToken(raw: DeviceTokenRaw): DeviceToken {
  return {
    id: raw.id,
    accountId: raw.accountId,
    systemId: raw.systemId,
    platform: raw.platform,
    token: raw.token,
    lastActiveAt: raw.lastActiveAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Narrow a paginated device token list result.
 */
export function narrowDeviceTokenPage(raw: DeviceTokenPage): {
  data: DeviceToken[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowDeviceToken),
    nextCursor: raw.nextCursor,
  };
}
