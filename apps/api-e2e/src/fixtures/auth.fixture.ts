/**
 * Playwright fixtures for authenticated API requests.
 *
 * Each test using `registeredAccount` gets a freshly registered account
 * with a unique email and valid session token. Tests needing IDOR
 * verification also get `secondRegisteredAccount` / `secondAuthHeaders`.
 */
import crypto from "node:crypto";

import { test as base, type APIRequestContext } from "@playwright/test";
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

import { ensureCryptoReady } from "./crypto.fixture.js";
import { asAuthHeaders } from "./http.constants.js";

import type { AuthHeaders } from "./http.constants.js";
import type { EncryptedPayload } from "@pluralscape/crypto";

interface InitiateData {
  accountId: string;
  kdfSalt: string;
  challengeNonce: string;
}

interface InitiateResponse {
  data: InitiateData;
}

interface CommitData {
  sessionToken: string;
  accountId: string;
  accountType: string;
}

interface CommitResponse {
  data: CommitData;
}

interface AccountInfo extends CommitData {
  email: string;
  password: string;
  recoveryKey: string;
  /** The account's Ed25519 signing keypair (for sync envelope signing). */
  signingKeypair: { publicKey: Uint8Array; secretKey: Uint8Array };
}

export interface AuthFixtures {
  /** A freshly registered account with session token. */
  registeredAccount: AccountInfo;
  /** Pre-built Authorization header for the registered account. */
  authHeaders: AuthHeaders;
  /** A second freshly registered account for IDOR / cross-account tests. */
  secondRegisteredAccount: AccountInfo;
  /** Pre-built Authorization header for the second account. */
  secondAuthHeaders: AuthHeaders;
}

function serializePayloadHex(payload: EncryptedPayload): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

async function registerUniqueAccount(request: APIRequestContext): Promise<AccountInfo> {
  const uuid = crypto.randomUUID();
  const email = `e2e-${uuid}@test.pluralscape.local`;
  const password = `E2E-TestPass-${uuid}`;

  // Phase 1: initiate
  const initiateRes = await request.post("/v1/auth/register/initiate", {
    data: { email },
  });

  if (!initiateRes.ok()) {
    const body = await initiateRes.text();
    throw new Error(`Registration initiate failed (${String(initiateRes.status())}): ${body}`);
  }

  const initiateEnvelope = (await initiateRes.json()) as InitiateResponse;
  const { accountId, kdfSalt, challengeNonce } = initiateEnvelope.data;

  // Phase 2: client-side crypto
  await initSodium();

  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = fromHex(kdfSalt);
  assertPwhashSalt(saltBytes);
  const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);

  const masterKey = generateMasterKey();
  const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);

  const { encryption, signing } = generateIdentityKeypair(masterKey);
  const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
  const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);

  const recovery = generateRecoveryKey(masterKey);

  const nonceBytes = fromHex(challengeNonce);
  const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

  // Phase 3: commit
  const commitRes = await request.post("/v1/auth/register/commit", {
    data: {
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
    },
  });

  if (!commitRes.ok()) {
    const body = await commitRes.text();
    throw new Error(`Registration commit failed (${String(commitRes.status())}): ${body}`);
  }

  const commitEnvelope = (await commitRes.json()) as CommitResponse;
  return {
    ...commitEnvelope.data,
    email,
    password,
    recoveryKey: recovery.displayKey,
    signingKeypair: {
      publicKey: signing.publicKey,
      secretKey: signing.secretKey,
    },
  };
}

export const test = base.extend<AuthFixtures>({
  registeredAccount: async ({ request }, use) => {
    await ensureCryptoReady();
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  authHeaders: async ({ registeredAccount }, use) => {
    await use(asAuthHeaders({ Authorization: `Bearer ${registeredAccount.sessionToken}` }));
  },
  secondRegisteredAccount: async ({ request }, use) => {
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  secondAuthHeaders: async ({ secondRegisteredAccount }, use) => {
    await use(asAuthHeaders({ Authorization: `Bearer ${secondRegisteredAccount.sessionToken}` }));
  },
});

export { expect } from "@playwright/test";
