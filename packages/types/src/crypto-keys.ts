// ── Crypto key brands ─────────────────────────────────────────────────────────
//
// Branded Uint8Array types for cryptographic keys. Defined here (in @pluralscape/types)
// so that @pluralscape/encryption can reference KdfMasterKey without depending on
// @pluralscape/crypto (which would be circular — crypto depends on types).
//
// @pluralscape/crypto imports KdfMasterKey from here and re-exports it so all
// consumers of crypto keys use a single canonical type definition.

declare const __cryptoBrand: unique symbol;

/**
 * Branded Uint8Array — makes crypto key types nominally distinct.
 * A `CryptoBrand<"KdfMasterKey">` is not assignable from a plain `Uint8Array`
 * or from `CryptoBrand<"AeadKey">`.
 */
export type CryptoBrand<B extends string> = Uint8Array & { readonly [__cryptoBrand]: B };

/**
 * The system's KDF master key (Argon2id-derived, 32 bytes).
 * Used to derive per-bucket symmetric keys and T1 encryption keys.
 * Never leaves the client unencrypted.
 */
export type KdfMasterKey = CryptoBrand<"KdfMasterKey">;
