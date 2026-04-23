import type { AccountId, DeviceTokenId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

/** Platforms that can receive push notifications. */
export type DeviceTokenPlatform = "ios" | "android" | "web";

/**
 * A registered device push token.
 * T3 (all fields) — server must read the token to deliver push notifications.
 */
export interface DeviceToken extends AuditMetadata {
  readonly id: DeviceTokenId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly platform: DeviceTokenPlatform;
  readonly token: string;
  readonly lastActiveAt: UnixMillis | null;
}
