import { brandId, toUnixMillis } from "@pluralscape/types";

import type {
  AccountId,
  DeviceToken,
  DeviceTokenId,
  DeviceTokenWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `deviceToken.list`. */
export interface DeviceTokenPage {
  readonly data: readonly DeviceTokenWire[];
  readonly nextCursor: string | null;
}

/**
 * Narrow a single device token wire object into a `DeviceToken`. Re-brands
 * IDs/timestamps stripped at the wire boundary. Device tokens have no
 * archive variant.
 */
export function narrowDeviceToken(raw: DeviceTokenWire): DeviceToken {
  return {
    id: brandId<DeviceTokenId>(raw.id),
    accountId: brandId<AccountId>(raw.accountId),
    systemId: brandId<SystemId>(raw.systemId),
    platform: raw.platform,
    token: raw.token,
    lastActiveAt: raw.lastActiveAt === null ? null : toUnixMillis(raw.lastActiveAt),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };
}

/** Narrow a paginated device token list result. */
export function narrowDeviceTokenPage(raw: DeviceTokenPage): {
  data: DeviceToken[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowDeviceToken),
    nextCursor: raw.nextCursor,
  };
}
