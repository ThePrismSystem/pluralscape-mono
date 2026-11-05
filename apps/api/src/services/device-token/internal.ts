import { brandId } from "@pluralscape/types";

import { hashSessionToken } from "../../lib/session-token.js";

import type {
  DeviceTokenResult,
  DeviceTokenId,
  DeviceTokenPlatform,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

/** Hash a device token using BLAKE2b (same pattern as session tokens). */
export function hashDeviceToken(token: string): string {
  return hashSessionToken(token);
}

export function toDeviceTokenResult(row: {
  id: string;
  systemId: string;
  platform: DeviceTokenPlatform;
  tokenHash: string;
  lastActiveAt: number | null;
  createdAt: number;
}): DeviceTokenResult {
  return {
    id: brandId<DeviceTokenId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    platform: row.platform,
    tokenHash: row.tokenHash,
    lastActiveAt: (row.lastActiveAt ?? null) as UnixMillis | null,
    createdAt: row.createdAt as UnixMillis,
  };
}
