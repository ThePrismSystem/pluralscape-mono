/**
 * Crypto helpers for E2E tests.
 *
 * Provides functions to encrypt/decrypt member data using a test master key,
 * and to create properly signed sync envelopes that pass server-side
 * signature verification.
 */
import {
  decryptTier1,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
  deserializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptChange, encryptSnapshot } from "@pluralscape/sync";

import { DUMMY_PLAINTEXT } from "./fixture.constants.js";

import type { SodiumAdapter } from "@pluralscape/crypto";
import type { DocumentKeys } from "@pluralscape/sync";
import type { SyncDocumentId } from "@pluralscape/types";
import type { T1EncryptedBlob } from "@pluralscape/types";

/** Cast a plain string to SyncDocumentId for use in tests. */
export function asSyncDocId(id: string): SyncDocumentId {
  return id as SyncDocumentId;
}

let initialized = false;
let testMasterKey: ReturnType<typeof generateMasterKey>;

/** Initialize libsodium and generate a test master key. Idempotent. */
export async function ensureCryptoReady(): Promise<void> {
  if (initialized) return;
  await initSodium();
  testMasterKey = generateMasterKey();
  initialized = true;
}

/** Encrypt a JSON payload as a T1 blob and return the base64 string the API expects. */
export function encryptForApi(data: unknown): string {
  const blob: T1EncryptedBlob = encryptTier1(data, testMasterKey);
  const binary = serializeEncryptedBlob(blob);
  return Buffer.from(binary).toString("base64");
}

/** Decrypt a base64 encryptedData string returned by the API back to the original JSON payload. */
export function decryptFromApi(base64Data: string): unknown {
  const binary = Buffer.from(base64Data, "base64");
  const blob = deserializeEncryptedBlob(new Uint8Array(binary));
  return decryptTier1(blob as T1EncryptedBlob, testMasterKey);
}

// ── Sync envelope signing ──────────────────────────────────────────

export interface SyncCryptoContext {
  sodium: SodiumAdapter;
  keys: DocumentKeys;
}

let sharedSodium: SodiumAdapter | null = null;

async function getOrInitSodium(): Promise<SodiumAdapter> {
  if (!sharedSodium) {
    const adapter = new WasmSodiumAdapter();
    await adapter.init();
    sharedSodium = adapter;
  }
  return sharedSodium;
}

/** Create a crypto context with fresh signing and encryption keys. */
export async function createSyncCryptoContext(): Promise<SyncCryptoContext> {
  const sodium = await getOrInitSodium();
  return {
    sodium,
    keys: {
      encryptionKey: sodium.aeadKeygen(),
      signingKeys: sodium.signKeypair(),
    },
  };
}

/** Wire-format change payload with base64url-encoded binary fields. */
export interface WireChangePayload {
  ciphertext: string;
  nonce: string;
  signature: string;
  authorPublicKey: string;
  documentId: string;
}

function toBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Create a properly signed wire-format change envelope.
 *
 * Uses encryptChange from @pluralscape/sync to produce a real Ed25519
 * signature over the AEAD ciphertext.
 */
export async function makeSignedChange(
  docId: SyncDocumentId,
  ctx?: SyncCryptoContext,
  plaintext?: Uint8Array,
): Promise<WireChangePayload> {
  const { sodium, keys } = ctx ?? (await createSyncCryptoContext());
  const data = plaintext ?? DUMMY_PLAINTEXT;
  const envelope = encryptChange(data, docId, keys, sodium);

  return {
    ciphertext: toBase64url(envelope.ciphertext),
    nonce: toBase64url(envelope.nonce),
    signature: toBase64url(envelope.signature),
    authorPublicKey: toBase64url(envelope.authorPublicKey),
    documentId: docId,
  };
}

/** Wire-format snapshot payload with base64url-encoded binary fields. */
export interface WireSnapshotPayload {
  ciphertext: string;
  nonce: string;
  signature: string;
  authorPublicKey: string;
  documentId: string;
  snapshotVersion: number;
}

/**
 * Create a properly signed wire-format snapshot envelope.
 */
export async function makeSignedSnapshot(
  docId: SyncDocumentId,
  snapshotVersion: number,
  ctx?: SyncCryptoContext,
  plaintext?: Uint8Array,
): Promise<WireSnapshotPayload> {
  const { sodium, keys } = ctx ?? (await createSyncCryptoContext());
  const data = plaintext ?? DUMMY_PLAINTEXT;
  const envelope = encryptSnapshot(data, docId, snapshotVersion, keys, sodium);

  return {
    ciphertext: toBase64url(envelope.ciphertext),
    nonce: toBase64url(envelope.nonce),
    signature: toBase64url(envelope.signature),
    authorPublicKey: toBase64url(envelope.authorPublicKey),
    documentId: docId,
    snapshotVersion,
  };
}
