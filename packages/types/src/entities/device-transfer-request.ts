import type { AccountId, DeviceTransferRequestId, SessionId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

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

/**
 * Server-visible DeviceTransferRequest metadata — raw Drizzle row shape.
 *
 * Extends the domain `DeviceTransferRequest` with the three server-only
 * columns required to validate the transfer: the encrypted key material
 * payload (nullable until the source session approves), the Argon2id
 * salt used to derive the transfer key from the user-supplied code, and
 * the attempt counter used to enforce `MAX_TRANSFER_CODE_ATTEMPTS`
 * against brute-force guesses.
 */
export interface DeviceTransferRequestServerMetadata extends DeviceTransferRequest {
  readonly encryptedKeyMaterial: Uint8Array | null;
  readonly codeSalt: Uint8Array;
  readonly codeAttempts: number;
}

/**
 * JSON-wire representation of a DeviceTransferRequest. Derived from the
 * domain `DeviceTransferRequest` type via `Serialize<T>`; branded IDs
 * become plain strings and `UnixMillis` becomes `number`.
 *
 * NB: Wire is derived from the domain type (not
 * `DeviceTransferRequestServerMetadata`) because the row carries the
 * encrypted key material, code salt, and attempt counter that the API
 * does not expose to clients.
 */
export type DeviceTransferRequestWire = Serialize<DeviceTransferRequest>;
