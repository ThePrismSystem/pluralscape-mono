/**
 * Minimal type declarations for react-native-libsodium.
 * Only the subset of the API used by ReactNativeSodiumAdapter is declared.
 * The actual types are provided by the react-native-libsodium package
 * when installed in a React Native project.
 */
declare module "react-native-libsodium" {
  interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }

  const ready: Promise<void>;
  function loadSumoVersion(): Promise<void>;

  const crypto_pwhash_ALG_ARGON2ID13: number;

  function randombytes_buf(length: number): Uint8Array;

  function crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | string | null,
    nsec: null,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;

  function crypto_aead_xchacha20poly1305_ietf_decrypt(
    nsec: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | string | null,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;

  function crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;

  function crypto_box_keypair(): KeyPair;
  function crypto_box_seed_keypair(seed: Uint8Array): KeyPair;
  function crypto_box_easy(
    message: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array,
  ): Uint8Array;
  function crypto_box_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array,
  ): Uint8Array;

  function crypto_sign_keypair(): KeyPair;
  function crypto_sign_detached(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
  function crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;

  function crypto_pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;

  function crypto_kdf_derive_from_key(
    subkeyLength: number,
    subkeyId: number,
    context: string,
    key: Uint8Array,
  ): Uint8Array;
  function crypto_kdf_keygen(): Uint8Array;

  function memzero(buffer: Uint8Array): void;
}
