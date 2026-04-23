import type { AccountId, AuthKeyId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

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
