import type { AccountId, DeviceTransferRequestId, SessionId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** Status of a device transfer request. */
export type DeviceTransferStatus = "pending" | "approved" | "expired";

/** A request to transfer encryption keys from one device to another. */
export interface DeviceTransferRequest {
  readonly id: DeviceTransferRequestId;
  readonly accountId: AccountId;
  readonly sourceSessionId: SessionId;
  readonly targetSessionId: SessionId | null;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis;
  readonly status: DeviceTransferStatus;
}

/** Encrypted master key payload for device transfer. */
export interface DeviceTransferPayload {
  readonly encryptedMasterKey: Uint8Array;
}
