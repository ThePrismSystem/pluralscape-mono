import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { AeadKey, AeadNonce, SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

export class SignatureVerificationError extends Error {
  override readonly name = "SignatureVerificationError" as const;

  constructor(message = "Envelope signature verification failed.", options?: ErrorOptions) {
    super(message, options);
  }
}

export class KeyBindingMismatchError extends Error {
  override readonly name = "KeyBindingMismatchError" as const;

  constructor(
    message = "Envelope authorPublicKey is not cryptographically bound to the document encryption key.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Thrown when AEAD decryption fails under a provided encryption key but the
 * signature over the ciphertext verified successfully is NOT asserted. Covers
 * benign causes such as rotated or stale encryption keys — the decryption
 * failure reflects key desync, not an active forgery attempt.
 */
export class EncryptionKeyMismatchError extends Error {
  override readonly name = "EncryptionKeyMismatchError" as const;

  constructor(
    message = "AEAD decryption failed under the provided encryption key.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * AEAD additional-data (AD) layout for sync envelopes.
 *
 * Changes  (AD_CHANGE):
 *   offset 0..7    : 8-byte domain separator "PLS-CHG1" (ASCII)
 *   offset 8..39   : 32-byte authorPublicKey (Ed25519 verifying key)
 *   offset 40..    : utf8(documentId)
 *
 * Snapshots (AD_SNAP):
 *   offset 0..7    : 8-byte domain separator "PLS-SNP1" (ASCII)
 *   offset 8..39   : 32-byte authorPublicKey
 *   offset 40..47  : 8-byte big-endian uint64 snapshotVersion
 *   offset 48..    : utf8(documentId)
 *
 * Including authorPublicKey in AD cryptographically binds the envelope
 * signature (which is over the ciphertext) to the encryption context:
 * any attempt to swap `authorPublicKey` after the fact causes AEAD
 * decryption to fail with an authentication tag mismatch. This closes
 * the gap where a valid-looking signature could be paired with an
 * envelope encrypted under a different key than the one whose public
 * half is advertised.
 */
const DOMAIN_SEP_BYTES = 8;
const SIGN_PUBLIC_KEY_BYTES = 32;
const VERSION_BYTES = 8;
const encoder = new TextEncoder();

const DOMAIN_SEP_CHANGE = encoder.encode("PLS-CHG1");
const DOMAIN_SEP_SNAPSHOT = encoder.encode("PLS-SNP1");

function buildChangeAD(documentId: string, authorPublicKey: Uint8Array): Uint8Array {
  const docIdBytes = encoder.encode(documentId);
  const ad = new Uint8Array(DOMAIN_SEP_BYTES + SIGN_PUBLIC_KEY_BYTES + docIdBytes.length);
  ad.set(DOMAIN_SEP_CHANGE, 0);
  ad.set(authorPublicKey, DOMAIN_SEP_BYTES);
  ad.set(docIdBytes, DOMAIN_SEP_BYTES + SIGN_PUBLIC_KEY_BYTES);
  return ad;
}

function buildSnapshotAD(
  documentId: string,
  snapshotVersion: number,
  authorPublicKey: Uint8Array,
): Uint8Array {
  const docIdBytes = encoder.encode(documentId);
  const ad = new Uint8Array(
    DOMAIN_SEP_BYTES + SIGN_PUBLIC_KEY_BYTES + VERSION_BYTES + docIdBytes.length,
  );
  ad.set(DOMAIN_SEP_SNAPSHOT, 0);
  ad.set(authorPublicKey, DOMAIN_SEP_BYTES);
  const versionOffset = DOMAIN_SEP_BYTES + SIGN_PUBLIC_KEY_BYTES;
  const view = new DataView(ad.buffer, ad.byteOffset + versionOffset, VERSION_BYTES);
  view.setBigUint64(0, BigInt(snapshotVersion), false); // big-endian
  ad.set(docIdBytes, versionOffset + VERSION_BYTES);
  return ad;
}

/**
 * Attempt AEAD decryption and classify a failure into the appropriate error.
 *
 * When `authorPublicKeyIsBound` is true, the caller has already verified the
 * envelope signature and the AD includes the envelope's authorPublicKey — the
 * only remaining cause of decryption failure under the provided key is a
 * binding mismatch (forged authorPublicKey). Otherwise a decrypt failure is
 * attributed to benign encryption-key desync.
 */
function aeadDecryptOrClassify(
  ciphertext: Uint8Array,
  nonce: AeadNonce,
  ad: Uint8Array,
  encryptionKey: AeadKey,
  sodium: SodiumAdapter,
  authorPublicKeyIsBound: boolean,
): Uint8Array {
  try {
    return sodium.aeadDecrypt(ciphertext, nonce, ad, encryptionKey);
  } catch (err: unknown) {
    if (authorPublicKeyIsBound) {
      throw new KeyBindingMismatchError(undefined, { cause: err });
    }
    throw new EncryptionKeyMismatchError(undefined, { cause: err });
  }
}

export function encryptChange(
  change: Uint8Array,
  documentId: SyncDocumentId,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): Omit<EncryptedChangeEnvelope, "seq"> {
  const ad = buildChangeAD(documentId, keys.signingKeys.publicKey);
  const { ciphertext, nonce } = sodium.aeadEncrypt(change, ad, keys.encryptionKey);
  const signature = sodium.signDetached(ciphertext, keys.signingKeys.secretKey);

  return {
    ciphertext,
    nonce,
    signature,
    authorPublicKey: keys.signingKeys.publicKey,
    documentId,
  };
}

export function decryptChange(
  envelope: EncryptedChangeEnvelope,
  encryptionKey: AeadKey,
  sodium: SodiumAdapter,
): Uint8Array {
  const sigValid = sodium.signVerifyDetached(
    envelope.signature,
    envelope.ciphertext,
    envelope.authorPublicKey,
  );
  if (!sigValid) {
    throw new SignatureVerificationError();
  }

  const ad = buildChangeAD(envelope.documentId, envelope.authorPublicKey);
  return aeadDecryptOrClassify(
    envelope.ciphertext,
    envelope.nonce,
    ad,
    encryptionKey,
    sodium,
    true,
  );
}

export function encryptSnapshot(
  snapshot: Uint8Array,
  documentId: SyncDocumentId,
  snapshotVersion: number,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): EncryptedSnapshotEnvelope {
  const ad = buildSnapshotAD(documentId, snapshotVersion, keys.signingKeys.publicKey);
  const { ciphertext, nonce } = sodium.aeadEncrypt(snapshot, ad, keys.encryptionKey);
  const signature = sodium.signDetached(ciphertext, keys.signingKeys.secretKey);

  return {
    ciphertext,
    nonce,
    signature,
    authorPublicKey: keys.signingKeys.publicKey,
    documentId,
    snapshotVersion,
  };
}

export function decryptSnapshot(
  envelope: EncryptedSnapshotEnvelope,
  encryptionKey: AeadKey,
  sodium: SodiumAdapter,
): Uint8Array {
  const sigValid = sodium.signVerifyDetached(
    envelope.signature,
    envelope.ciphertext,
    envelope.authorPublicKey,
  );
  if (!sigValid) {
    throw new SignatureVerificationError();
  }

  const ad = buildSnapshotAD(
    envelope.documentId,
    envelope.snapshotVersion,
    envelope.authorPublicKey,
  );
  return aeadDecryptOrClassify(
    envelope.ciphertext,
    envelope.nonce,
    ad,
    encryptionKey,
    sodium,
    true,
  );
}

export function verifyEnvelopeSignature(
  envelope: EncryptedChangeEnvelope | EncryptedSnapshotEnvelope,
  sodium: SodiumAdapter,
): boolean {
  return sodium.signVerifyDetached(
    envelope.signature,
    envelope.ciphertext,
    envelope.authorPublicKey,
  );
}
