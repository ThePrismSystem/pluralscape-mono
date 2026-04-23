import type { AccountId, Brand } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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

/**
 * Server-visible Account metadata — raw Drizzle row shape.
 *
 * Account is a plaintext entity (no client-side encryption), so `server`
 * carries the full domain type plus server-only registration + operational
 * columns the domain doesn't expose: the two-phase registration challenge
 * (`challengeNonce` + `challengeExpiresAt`), the server-held encrypted email
 * used for operational mail (ADR 029), and the `auditLogIpTracking` toggle
 * (ADR 028).
 */
export interface AccountServerMetadata extends Account {
  /** Challenge nonce for two-phase registration. Cleared after successful commit. */
  readonly challengeNonce: Uint8Array | null;
  /** Expiry time for the challenge nonce (5 minutes after creation). */
  readonly challengeExpiresAt: UnixMillis | null;
  /** Server-side encrypted email for operational communication (ADR 029). Null for pre-migration accounts. */
  readonly encryptedEmail: Uint8Array | null;
  /** When true, IP address and user-agent are persisted in audit log entries (ADR 028). */
  readonly auditLogIpTracking: boolean;
}

/**
 * JSON-wire representation of an Account. Derived from the domain `Account`
 * type via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`, and `Uint8Array` becomes `string` (base64).
 */
export type AccountWire = Serialize<Account>;
