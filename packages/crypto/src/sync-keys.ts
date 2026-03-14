import { KDF_KEY_BYTES } from "./constants.js";
import { getSodium } from "./sodium.js";

import type { SodiumAdapter } from "./adapter/interface.js";
import type { AeadKey, KdfMasterKey } from "./types.js";

/**
 * KDF context for sync-layer encryption sub-keys (must be exactly 8 bytes).
 *
 * Known KDF contexts in this codebase:
 * - "dataencr" — T1 data-at-rest encryption (tiers.ts)
 * - "bktkeywp" — bucket key wrapping (bucket-keys.ts)
 * - "identity" — identity keypair derivation (identity.ts)
 * - "syncdocx" — sync document transport encryption (this file)
 */
const KDF_CONTEXT_SYNC = "syncdocx";

/** KDF sub-key ID for sync document encryption. */
const SUBKEY_SYNC_ENCRYPTION = 1;

/**
 * Derive a sync-layer encryption key from the master key.
 *
 * Uses a separate KDF context ("syncdocx") from T1 data-at-rest ("dataencr")
 * to maintain key isolation between storage and transport encryption.
 *
 * Caller is responsible for zeroing the returned key via `adapter.memzero()`.
 *
 * @param masterKey - The system master key
 * @param adapter - Optional SodiumAdapter; defaults to the global singleton via getSodium()
 */
export function deriveSyncEncryptionKey(masterKey: KdfMasterKey, adapter?: SodiumAdapter): AeadKey {
  const sodium = adapter ?? getSodium();
  return sodium.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_SYNC_ENCRYPTION,
    KDF_CONTEXT_SYNC,
    masterKey,
  ) as AeadKey;
}
