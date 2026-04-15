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
  serializePublicKey,
  signChallenge,
  toHex,
  wrapMasterKey,
} from "@pluralscape/crypto";
import { TRPCClientError } from "@trpc/client";

import { expect, test } from "../../fixtures/trpc.fixture.js";

import type { EncryptedPayload } from "@pluralscape/crypto";

function serializePayloadHex(payload: EncryptedPayload): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

test.describe("tRPC auth router", () => {
  test("register (two-phase), login, list sessions, logout via tRPC", async ({
    anonTrpc,
    trpc,
  }) => {
    const uuid = crypto.randomUUID();
    const email = `trpc-e2e-${uuid}@test.pluralscape.local`;
    const password = `TRPCPass-${uuid}`;

    let sessionToken: string;
    let authKeyHex: string;

    await test.step("initiate registration", async () => {
      const result = await anonTrpc.auth.registrationInitiate.mutate({ email });
      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("kdfSalt");
      expect(result).toHaveProperty("challengeNonce");
    });

    await test.step("commit registration with crypto material", async () => {
      const initResult = await anonTrpc.auth.registrationInitiate.mutate({ email: email + ".2" });

      await initSodium();
      const passwordBytes = new TextEncoder().encode(password);
      const saltBytes = fromHex(initResult.kdfSalt);
      assertPwhashSalt(saltBytes);
      const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
      authKeyHex = toHex(authKey);

      const masterKey = generateMasterKey();
      const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
      const { encryption, signing } = generateIdentityKeypair(masterKey);
      const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
      const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);
      const recovery = generateRecoveryKey(masterKey);
      const nonceBytes = fromHex(initResult.challengeNonce);
      const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

      const commitResult = await anonTrpc.auth.registrationCommit.mutate({
        accountId: initResult.accountId,
        authKey: authKeyHex,
        encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
        encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
        encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
        publicSigningKey: serializePublicKey(signing.publicKey),
        publicEncryptionKey: serializePublicKey(encryption.publicKey),
        recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
        challengeSignature: toHex(challengeSignature),
        recoveryKeyBackupConfirmed: true,
      });
      expect(commitResult).toHaveProperty("sessionToken");
      expect(commitResult).toHaveProperty("accountId");
      expect(commitResult.accountType).toBe("system");
      sessionToken = commitResult.sessionToken;
      expect(sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    await test.step("login with registered credentials", async () => {
      const commitEmail = email + ".2";
      const loginResult = await anonTrpc.auth.login.mutate({
        email: commitEmail,
        authKey: authKeyHex,
      });
      expect(loginResult).toHaveProperty("sessionToken");
      expect(loginResult.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    await test.step("list sessions returns current session", async () => {
      const result = await trpc.auth.session.list.query({});
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(result.sessions.length).toBeGreaterThanOrEqual(1);
    });

    await test.step("logout succeeds", async () => {
      const result = await trpc.auth.logout.mutate();
      expect(result.success).toBe(true);
    });
  });

  test("login with wrong auth key throws UNAUTHORIZED", async ({ anonTrpc }) => {
    const uuid = crypto.randomUUID();
    const email = `trpc-e2e-${uuid}@test.pluralscape.local`;
    const password = `CorrectPass-${uuid}`;

    // Register so the account exists
    const initResult = await anonTrpc.auth.registrationInitiate.mutate({ email });

    await initSodium();
    const passwordBytes = new TextEncoder().encode(password);
    const saltBytes = fromHex(initResult.kdfSalt);
    assertPwhashSalt(saltBytes);
    const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);

    const masterKey = generateMasterKey();
    const encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
    const { encryption, signing } = generateIdentityKeypair(masterKey);
    const encryptedSigningPrivateKey = encryptPrivateKey(signing.secretKey, masterKey);
    const encryptedEncryptionPrivateKey = encryptPrivateKey(encryption.secretKey, masterKey);
    const recovery = generateRecoveryKey(masterKey);
    const nonceBytes = fromHex(initResult.challengeNonce);
    const challengeSignature = signChallenge(nonceBytes, signing.secretKey);

    await anonTrpc.auth.registrationCommit.mutate({
      accountId: initResult.accountId,
      authKey: toHex(authKey),
      encryptedMasterKey: serializePayloadHex(encryptedMasterKey),
      encryptedSigningPrivateKey: serializePayloadHex(encryptedSigningPrivateKey),
      encryptedEncryptionPrivateKey: serializePayloadHex(encryptedEncryptionPrivateKey),
      publicSigningKey: serializePublicKey(signing.publicKey),
      publicEncryptionKey: serializePublicKey(encryption.publicKey),
      recoveryEncryptedMasterKey: serializePayloadHex(recovery.encryptedMasterKey),
      challengeSignature: toHex(challengeSignature),
      recoveryKeyBackupConfirmed: true,
    });

    const wrongAuthKey = "0".repeat(64);
    await expect(anonTrpc.auth.login.mutate({ email, authKey: wrongAuthKey })).rejects.toThrow(
      TRPCClientError,
    );
  });

  test("listSessions without auth throws UNAUTHORIZED", async ({ anonTrpc }) => {
    await expect(anonTrpc.auth.session.list.query({})).rejects.toThrow(TRPCClientError);
  });
});
