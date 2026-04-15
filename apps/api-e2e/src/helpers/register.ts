/**
 * Shared two-phase registration helper for E2E tests.
 *
 * Performs the initiate/commit flow with full client-side crypto,
 * returning account credentials including the derived authKey.
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

import type { APIRequestContext } from "@playwright/test";
import type { EncryptedPayload } from "@pluralscape/crypto";

interface InitiateData {
  accountId: string;
  kdfSalt: string;
  challengeNonce: string;
}

interface CommitData {
  sessionToken: string;
  accountId: string;
  accountType: string;
}

export interface RegisteredAccount {
  accountId: string;
  sessionToken: string;
  email: string;
  password: string;
  authKeyHex: string;
  accountType: string;
}

function serializePayloadHex(payload: EncryptedPayload): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

export async function registerAccount(
  request: APIRequestContext,
  opts: { emailPrefix?: string; accountType?: string } = {},
): Promise<RegisteredAccount> {
  await initSodium();

  const uuid = crypto.randomUUID();
  const emailPrefix = opts.emailPrefix ?? "e2e";
  const email = `${emailPrefix}-${uuid}@test.pluralscape.local`;
  const password = `E2E-TestPass-${uuid}`;

  // Phase 1: initiate
  const initiateRes = await request.post("/v1/auth/register/initiate", {
    data: { email, ...(opts.accountType ? { accountType: opts.accountType } : {}) },
  });
  if (!initiateRes.ok()) {
    throw new Error(
      `Registration initiate failed (${String(initiateRes.status())}): ${await initiateRes.text()}`,
    );
  }
  const { data: initData } = (await initiateRes.json()) as { data: InitiateData };

  // Client-side crypto
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = fromHex(initData.kdfSalt);
  assertPwhashSalt(saltBytes);
  const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
  const authKeyHex = toHex(authKey);

  const masterKey = generateMasterKey();
  const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
  const { encryption, signing } = generateIdentityKeypair(masterKey);
  const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
  const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);
  const recovery = generateRecoveryKey(masterKey);
  const nonceBytes = fromHex(initData.challengeNonce);
  const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

  // Phase 2: commit
  const commitRes = await request.post("/v1/auth/register/commit", {
    data: {
      accountId: initData.accountId,
      authKey: authKeyHex,
      encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
      encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
      encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
      publicSigningKey: toHex(signing.publicKey),
      publicEncryptionKey: toHex(encryption.publicKey),
      recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
      challengeSignature: toHex(challengeSignature),
      recoveryKeyBackupConfirmed: true,
    },
  });
  if (!commitRes.ok()) {
    throw new Error(
      `Registration commit failed (${String(commitRes.status())}): ${await commitRes.text()}`,
    );
  }

  const { data: commitData } = (await commitRes.json()) as { data: CommitData };
  return {
    ...commitData,
    email,
    password,
    authKeyHex,
  };
}
