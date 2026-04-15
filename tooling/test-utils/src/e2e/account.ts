/**
 * Account registration and system discovery helpers for E2E tests.
 */
import crypto from "node:crypto";

import {
  assertPwhashSalt,
  deriveAuthAndPasswordKeys,
  encryptPrivateKey,
  fromHex,
  generateIdentityKeypair,
  generateMasterKey,
  generateRecoveryKey,
  initSodium,
  signChallenge,
  toHex,
  wrapMasterKey,
} from "@pluralscape/crypto";

import { API_BASE_URL } from "./api-server.js";

import type { EncryptedPayload } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

// ── Registration ─────────────────────────────────────────────────────

interface InitiateResponse {
  data: {
    accountId: string;
    kdfSalt: string;
    challengeNonce: string;
  };
}

interface CommitData {
  sessionToken: string;
  accountId: string;
  accountType: string;
}

interface CommitResponse {
  data: CommitData;
}

export interface RegisteredAccount {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  email: string;
  password: string;
}

function serializePayloadHex(payload: EncryptedPayload): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

/**
 * Register a fresh test account against the E2E API server.
 */
export async function registerTestAccount(): Promise<RegisteredAccount> {
  const uuid = crypto.randomUUID();
  const email = `e2e-import-${uuid}@test.pluralscape.local`;
  const password = `E2E-ImportTest-${uuid}`;

  // Phase 1: initiate
  const initiateRes = await fetch(`${API_BASE_URL}/v1/auth/register/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!initiateRes.ok) {
    const body = await initiateRes.text();
    throw new Error(`Registration initiate failed (${String(initiateRes.status)}): ${body}`);
  }

  const initiateEnvelope = (await initiateRes.json()) as InitiateResponse;
  const { accountId, kdfSalt, challengeNonce } = initiateEnvelope.data;

  // Phase 2: client-side crypto
  await initSodium();

  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = fromHex(kdfSalt);
  assertPwhashSalt(saltBytes);
  const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(
    passwordBytes,
    saltBytes,
    password.length,
  );

  const masterKey = generateMasterKey();
  const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);

  const { encryption, signing } = generateIdentityKeypair(masterKey);
  const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
  const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);

  const recovery = generateRecoveryKey(masterKey);
  const recoveryKeyHashHex = toHex(recovery.recoveryKeyHash);

  const nonceBytes = fromHex(challengeNonce);
  const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

  // Phase 3: commit
  const commitRes = await fetch(`${API_BASE_URL}/v1/auth/register/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId,
      authKey: toHex(authKey),
      encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
      encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
      encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
      publicSigningKey: toHex(signing.publicKey),
      publicEncryptionKey: toHex(encryption.publicKey),
      recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
      challengeSignature: toHex(challengeSignature),
      recoveryKeyBackupConfirmed: true,
      recoveryKeyHash: recoveryKeyHashHex,
    }),
  });

  if (!commitRes.ok) {
    const body = await commitRes.text();
    throw new Error(`Registration commit failed (${String(commitRes.status)}): ${body}`);
  }

  const commitEnvelope = (await commitRes.json()) as CommitResponse;
  return {
    sessionToken: commitEnvelope.data.sessionToken,
    recoveryKey: recovery.displayKey,
    accountId: commitEnvelope.data.accountId,
    email,
    password,
  };
}

// ── System discovery ────────────────────────────────────────────────

interface SystemListItem {
  id: string;
}

interface SystemListResponse {
  data: SystemListItem[];
}

/**
 * Fetch the first system ID for the authenticated account via REST.
 */
export async function getSystemId(sessionToken: string): Promise<SystemId> {
  const res = await fetch(`${API_BASE_URL}/v1/systems`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list systems (${String(res.status)}): ${body}`);
  }

  const body = (await res.json()) as SystemListResponse;
  const first = body.data[0];
  if (!first) {
    throw new Error("No systems found for authenticated account");
  }
  return first.id as SystemId;
}
