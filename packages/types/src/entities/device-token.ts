import type { AccountId, DeviceTokenId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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

/**
 * Server-visible DeviceToken metadata — raw Drizzle row shape.
 *
 * The server never stores raw push tokens — it keeps only a `tokenHash`
 * for identification. The DB row also has a nullable `revokedAt`
 * timestamp (for tracking token invalidation) that the domain type
 * doesn't expose, and omits the `updatedAt`/`version` fields from
 * `AuditMetadata` since device token rows are never mutated after
 * creation (only inserted/revoked).
 */
export interface DeviceTokenServerMetadata {
  readonly id: DeviceTokenId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly platform: DeviceTokenPlatform;
  readonly tokenHash: string;
  readonly createdAt: UnixMillis;
  readonly lastActiveAt: UnixMillis | null;
  readonly revokedAt: UnixMillis | null;
}

/**
 * JSON-wire representation of a DeviceToken. Derived from the domain
 * `DeviceToken` type via `Serialize<T>`; branded IDs become plain strings
 * and `UnixMillis` becomes `number`.
 *
 * NB: Wire is derived from the domain type (not `DeviceTokenServerMetadata`)
 * because the row stores `tokenHash` (not the raw `token` the client
 * submits) and lacks the audit-metadata columns (`updatedAt`, `version`)
 * the domain carries via `AuditMetadata`. The API never returns the raw
 * token to the client.
 */
export type DeviceTokenWire = Serialize<DeviceToken>;
