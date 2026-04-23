import type { AccountId, RecoveryKeyId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** An encrypted recovery key for account recovery. Immutable after creation. */
export interface RecoveryKey {
  readonly id: RecoveryKeyId;
  readonly accountId: AccountId;
  readonly encryptedMasterKey: Uint8Array;
  readonly recoveryKeyHash: Uint8Array | null;
  readonly createdAt: UnixMillis;
  readonly revokedAt: UnixMillis | null;
}
