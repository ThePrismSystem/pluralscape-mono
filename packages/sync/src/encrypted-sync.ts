import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { AeadKey, SodiumAdapter } from "@pluralscape/crypto";

export class SignatureVerificationError extends Error {
  override readonly name = "SignatureVerificationError" as const;

  constructor(message = "Envelope signature verification failed.") {
    super(message);
  }
}

const BYTE_MASK = 0xff;
const VERSION_BYTES = 8;

function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & BYTE_MASK;
  }
  return bytes;
}

function buildChangeAD(documentId: string): Uint8Array {
  return stringToBytes(documentId);
}

function buildSnapshotAD(documentId: string, snapshotVersion: number): Uint8Array {
  const docIdBytes = stringToBytes(documentId);
  const versionBytes = new Uint8Array(VERSION_BYTES);
  const view = new DataView(versionBytes.buffer);
  view.setBigUint64(0, BigInt(snapshotVersion), false); // big-endian
  const ad = new Uint8Array(docIdBytes.length + VERSION_BYTES);
  ad.set(docIdBytes, 0);
  ad.set(versionBytes, docIdBytes.length);
  return ad;
}

export function encryptChange(
  change: Uint8Array,
  documentId: string,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): Omit<EncryptedChangeEnvelope, "seq"> {
  const ad = buildChangeAD(documentId);
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

  const ad = buildChangeAD(envelope.documentId);
  return sodium.aeadDecrypt(envelope.ciphertext, envelope.nonce, ad, encryptionKey);
}

export function encryptSnapshot(
  snapshot: Uint8Array,
  documentId: string,
  snapshotVersion: number,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): EncryptedSnapshotEnvelope {
  const ad = buildSnapshotAD(documentId, snapshotVersion);
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

  const ad = buildSnapshotAD(envelope.documentId, envelope.snapshotVersion);
  return sodium.aeadDecrypt(envelope.ciphertext, envelope.nonce, ad, encryptionKey);
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
