import type { AccountId, AuthKeyId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** Whether an auth key is used for encryption or signing. */
export type AuthKeyType = "encryption" | "signing";

/** A cryptographic keypair associated with an account. Immutable after creation. */
export interface AuthKey {
  readonly id: AuthKeyId;
  readonly accountId: AccountId;
  readonly encryptedPrivateKey: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly keyType: AuthKeyType;
  readonly createdAt: UnixMillis;
}

/**
 * Server-visible AuthKey metadata — raw Drizzle row shape.
 *
 * The `auth_keys` table row matches the domain `AuthKey` type exactly:
 * the encrypted private key is stored server-side (as an opaque blob
 * wrapped under the account's KEK) since AuthKey is the account-level
 * keypair, not a per-bucket key. No extra server-only columns.
 */
export type AuthKeyServerMetadata = AuthKey;

/**
 * JSON-wire representation of an AuthKey. Derived from
 * `AuthKeyServerMetadata` via `Serialize<T>`; branded IDs become plain
 * strings, `UnixMillis` becomes `number`, and `Uint8Array` becomes `string`
 * (base64).
 */
export type AuthKeyWire = Serialize<AuthKeyServerMetadata>;
