import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { AeadKey, SodiumAdapter } from "@pluralscape/crypto";
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
  try {
    return sodium.aeadDecrypt(envelope.ciphertext, envelope.nonce, ad, encryptionKey);
  } catch (err: unknown) {
    // A valid signature paired with an AEAD failure indicates key-binding
    // mismatch: the envelope's signing key is not the one used to encrypt.
    throw new KeyBindingMismatchError(undefined, { cause: err });
  }
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
  try {
    return sodium.aeadDecrypt(envelope.ciphertext, envelope.nonce, ad, encryptionKey);
  } catch (err: unknown) {
    throw new KeyBindingMismatchError(undefined, { cause: err });
  }
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

/**
 * Assert that the signing key in an envelope is cryptographically bound to
 * the encryption key. Succeeds if decryption under the provided encryption
 * key and the envelope's advertised authorPublicKey produces a valid AEAD
 * authentication tag. Throws KeyBindingMismatchError otherwise.
 *
 * Callers that already need the plaintext should use decryptChange /
 * decryptSnapshot directly — those functions enforce the same binding and
 * return the plaintext in the same call.
 */
export function verifyKeyBinding(
  envelope: EncryptedChangeEnvelope | EncryptedSnapshotEnvelope,
  encryptionKey: AeadKey,
  sodium: SodiumAdapter,
): void {
  const ad =
    "snapshotVersion" in envelope
      ? buildSnapshotAD(envelope.documentId, envelope.snapshotVersion, envelope.authorPublicKey)
      : buildChangeAD(envelope.documentId, envelope.authorPublicKey);
  try {
    sodium.aeadDecrypt(envelope.ciphertext, envelope.nonce, ad, encryptionKey);
  } catch (err: unknown) {
    throw new KeyBindingMismatchError(undefined, { cause: err });
  }
}
