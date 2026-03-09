// @pluralscape/crypto — libsodium encryption layer

// ── Types ───────────────────────────────────────────────────────────
export type { AeadResult, CryptoKeypair } from "./types.js";
export type { SodiumAdapter, SodiumConstants } from "./adapter/interface.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  AlreadyInitializedError,
  CryptoNotReadyError,
  DecryptionFailedError,
  UnsupportedOperationError,
} from "./errors.js";

// ── Constants ───────────────────────────────────────────────────────
export {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  BOX_MAC_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MODERATE,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
} from "./constants.js";

// ── Sodium lifecycle ────────────────────────────────────────────────
export { configureSodium, getSodium, initSodium, isReady } from "./sodium.js";

// ── Adapters ────────────────────────────────────────────────────────
export { WasmSodiumAdapter } from "./adapter/wasm-adapter.js";
export { ReactNativeSodiumAdapter } from "./adapter/react-native-adapter.js";
