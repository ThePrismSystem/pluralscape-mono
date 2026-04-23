import type { AccountId, SessionId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** An active session on a device. */
export interface Session {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly createdAt: UnixMillis;
  readonly lastActive: UnixMillis | null;
  readonly revoked: boolean;
  readonly expiresAt: UnixMillis | null;
}

/**
 * Device metadata stored inside the session's encryptedData blob.
 * The server never sees this in plaintext — it is T1 encrypted.
 */
export interface DeviceInfo {
  readonly platform: string;
  readonly appVersion: string;
  readonly deviceName: string;
}
