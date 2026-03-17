import type {
  AccountId,
  AuthKeyId,
  DeviceTransferRequestId,
  RecoveryKeyId,
  SessionId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** Whether an auth key is used for encryption or signing. */
export type AuthKeyType = "encryption" | "signing";

/** Whether an account belongs to a system or a non-system viewer (therapist, friend). */
export type AccountType = "system" | "viewer";

/** Status of a device transfer request. */
export type DeviceTransferStatus = "pending" | "approved" | "expired";

/** A user account — the top-level authentication entity. */
export interface Account extends AuditMetadata {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly emailHash: string;
  readonly emailSalt: string;
  readonly passwordHash: string;
  readonly kdfSalt: string;
  /**
   * Persistent random MasterKey wrapped by the password-derived key (KEK/DEK pattern).
   * Null for legacy accounts that have not yet migrated to the two-layer architecture.
   */
  readonly encryptedMasterKey: Uint8Array | null;
}

/** A cryptographic keypair associated with an account. Immutable after creation. */
export interface AuthKey {
  readonly id: AuthKeyId;
  readonly accountId: AccountId;
  readonly encryptedPrivateKey: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly keyType: AuthKeyType;
  readonly createdAt: UnixMillis;
}

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

/** An encrypted recovery key for account recovery. Immutable after creation. */
export interface RecoveryKey {
  readonly id: RecoveryKeyId;
  readonly accountId: AccountId;
  readonly encryptedMasterKey: Uint8Array;
  readonly createdAt: UnixMillis;
  readonly revokedAt: UnixMillis | null;
}

/** Input type for login. */
export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

/** Input type for registration. */
export interface RegistrationInput {
  readonly email: string;
  readonly password: string;
  readonly recoveryKeyBackupConfirmed: boolean;
  readonly accountType: AccountType;
}

/** A request to transfer encryption keys from one device to another. */
export interface DeviceTransferRequest {
  readonly id: DeviceTransferRequestId;
  readonly accountId: AccountId;
  readonly sourceSessionId: SessionId;
  readonly targetSessionId: SessionId;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis;
  readonly status: DeviceTransferStatus;
}

/** Encrypted master key payload for device transfer. */
export interface DeviceTransferPayload {
  readonly encryptedMasterKey: Uint8Array;
}
