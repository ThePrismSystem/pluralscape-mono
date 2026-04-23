import type { AccountId, Brand } from "../ids.js";
import type { AuditMetadata } from "../utility.js";

/** Whether an account belongs to a system or a non-system viewer (therapist, friend). */
export type AccountType = "system" | "viewer";

/** Account ID for a phase-1 registration placeholder (not yet committed). */
export type PendingAccountId = Brand<string, "PendingAccountId">;

/** A user account — the top-level authentication entity. */
export interface Account extends AuditMetadata {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly emailHash: string;
  readonly emailSalt: string;
  readonly authKeyHash: Uint8Array;
  readonly kdfSalt: string;
  /** Persistent random MasterKey wrapped by the password-derived key (KEK/DEK pattern). */
  readonly encryptedMasterKey: Uint8Array;
}

/** Input type for login. */
export interface LoginCredentials {
  readonly email: string;
  readonly authKey: string;
}

/** Input for registration phase 1: initiate. */
export interface RegistrationInitiateInput {
  readonly email: string;
  readonly accountType: AccountType;
}

/** Input for registration phase 2: commit. */
export interface RegistrationCommitInput {
  readonly accountId: string;
  readonly authKey: string;
  readonly encryptedMasterKey: string;
  readonly encryptedSigningPrivateKey: string;
  readonly encryptedEncryptionPrivateKey: string;
  readonly publicSigningKey: string;
  readonly publicEncryptionKey: string;
  readonly recoveryEncryptedMasterKey: string;
  readonly challengeSignature: string;
  readonly recoveryKeyBackupConfirmed: boolean;
  readonly recoveryKeyHash: string;
}
