import crypto from "node:crypto";

import { expect, test } from "@playwright/test";
import {
  assertPwhashSalt,
  deriveAuthAndPasswordKeys,
  encryptPrivateKey,
  fromHex,
  generateIdentityKeypair,
  generateMasterKey,
  generateRecoveryKey,
  initSodium,
  serializePublicKey,
  signChallenge,
  toHex,
  wrapMasterKey,
} from "@pluralscape/crypto";

import type { EncryptedPayload } from "@pluralscape/crypto";

function serializePayloadHex(payload: EncryptedPayload): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

test.describe("Two-phase registration", () => {
  test("initiate + commit creates account and returns session data", async ({ request }) => {
    await initSodium();
    const email = `e2e-${crypto.randomUUID()}@test.pluralscape.local`;
    const password = "ValidPassword123!";

    // Phase 1: initiate
    const initiateRes = await request.post("/v1/auth/register/initiate", {
      data: { email },
    });
    expect(initiateRes.status()).toBe(201);
    const initBody = (await initiateRes.json()) as {
      data: { accountId: string; kdfSalt: string; challengeNonce: string };
    };
    expect(initBody.data.accountId).toBeTruthy();
    expect(initBody.data.kdfSalt).toBeTruthy();
    expect(initBody.data.challengeNonce).toBeTruthy();

    // Client-side crypto
    const passwordBytes = new TextEncoder().encode(password);
    const saltBytes = fromHex(initBody.data.kdfSalt);
    assertPwhashSalt(saltBytes);
    const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);

    const masterKey = generateMasterKey();
    const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
    const { encryption, signing } = generateIdentityKeypair(masterKey);
    const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
    const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);
    const recovery = generateRecoveryKey(masterKey);
    const nonceBytes = fromHex(initBody.data.challengeNonce);
    const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

    // Phase 2: commit
    const commitRes = await request.post("/v1/auth/register/commit", {
      data: {
        accountId: initBody.data.accountId,
        authKey: toHex(authKey),
        encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
        encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
        encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
        publicSigningKey: serializePublicKey(signing.publicKey),
        publicEncryptionKey: serializePublicKey(encryption.publicKey),
        recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
        challengeSignature: toHex(challengeSignature),
        recoveryKeyBackupConfirmed: true,
      },
    });

    expect(commitRes.status()).toBe(201);
    const body = await commitRes.json();
    expect(body).toHaveProperty("data.sessionToken");
    expect(body).toHaveProperty("data.accountId");
    expect((body as { data: { accountType: string } }).data.accountType).toBe("system");
    expect((body as { data: { sessionToken: string } }).data.sessionToken).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  test("initiate rejects missing email", async ({ request }) => {
    const res = await request.post("/v1/auth/register/initiate", {
      data: {},
    });

    expect(res.status()).toBe(400);
  });

  test("duplicate email initiate returns fake 201 (anti-enumeration)", async ({ request }) => {
    await initSodium();
    const email = `e2e-${crypto.randomUUID()}@test.pluralscape.local`;
    const password = "ValidPassword123!";

    // Register the first account fully
    const init1 = await request.post("/v1/auth/register/initiate", { data: { email } });
    expect(init1.status()).toBe(201);
    const { data: initData1 } = (await init1.json()) as {
      data: { accountId: string; kdfSalt: string; challengeNonce: string };
    };

    const passwordBytes = new TextEncoder().encode(password);
    const saltBytes = fromHex(initData1.kdfSalt);
    assertPwhashSalt(saltBytes);
    const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
    const masterKey = generateMasterKey();
    const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
    const { encryption, signing } = generateIdentityKeypair(masterKey);
    const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
    const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);
    const recovery = generateRecoveryKey(masterKey);
    const nonceBytes = fromHex(initData1.challengeNonce);
    const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

    const commit1 = await request.post("/v1/auth/register/commit", {
      data: {
        accountId: initData1.accountId,
        authKey: toHex(authKey),
        encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
        encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
        encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
        publicSigningKey: serializePublicKey(signing.publicKey),
        publicEncryptionKey: serializePublicKey(encryption.publicKey),
        recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
        challengeSignature: toHex(challengeSignature),
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(commit1.status()).toBe(201);

    // Anti-enumeration: second initiate with same email returns fake success
    const init2 = await request.post("/v1/auth/register/initiate", { data: { email } });
    expect(init2.status()).toBe(201);
    const body2 = (await init2.json()) as {
      data: { accountId: string; kdfSalt: string; challengeNonce: string };
    };
    expect(body2.data.accountId).toBeTruthy();
    expect(body2.data.kdfSalt).toBeTruthy();
    expect(body2.data.challengeNonce).toBeTruthy();
  });
});
