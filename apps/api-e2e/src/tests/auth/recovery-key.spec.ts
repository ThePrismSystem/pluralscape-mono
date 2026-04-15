import crypto from "node:crypto";

import {
  assertPwhashSalt,
  deriveAuthAndPasswordKeys,
  fromHex,
  generateMasterKey,
  generateRecoveryKey,
  hashRecoveryKey,
  initSodium,
  toHex,
} from "@pluralscape/crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";

import type { APIRequestContext } from "@playwright/test";

function serializePayloadHex(payload: { nonce: Uint8Array; ciphertext: Uint8Array }): string {
  const buf = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  buf.set(payload.nonce, 0);
  buf.set(payload.ciphertext, payload.nonce.length);
  return toHex(buf);
}

/**
 * Retrieve the kdfSalt for an account and derive the authKey from the password.
 */
async function deriveAuthKeyForAccount(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ authKeyHex: string }> {
  await initSodium();

  const saltRes = await request.post("/v1/auth/salt", { data: { email } });
  const saltBody = (await saltRes.json()) as { data: { kdfSalt: string } };
  const saltBytes = fromHex(saltBody.data.kdfSalt);
  assertPwhashSalt(saltBytes);

  const passwordBytes = new TextEncoder().encode(password);
  const { authKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
  return { authKeyHex: toHex(authKey) };
}

test.describe("GET /v1/auth/recovery-key/status", () => {
  test("returns active recovery key status for a registered account", async ({
    request,
    authHeaders,
  }) => {
    const res = await request.get("/v1/auth/recovery-key/status", {
      headers: authHeaders,
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { hasActiveKey: boolean; createdAt: number } };
    expect(body.data.hasActiveKey).toBe(true);
    expect(typeof body.data.createdAt).toBe("number");
  });

  test("returns 401 without auth", async ({ request }) => {
    const res = await request.get("/v1/auth/recovery-key/status");
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /v1/auth/recovery-key/regenerate", () => {
  test("regenerates recovery key with valid auth key and new encrypted backup", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const { authKeyHex } = await deriveAuthKeyForAccount(
      request,
      registeredAccount.email,
      registeredAccount.password,
    );

    // Generate new recovery key crypto material
    const masterKey = generateMasterKey();
    const newRecovery = generateRecoveryKey(masterKey);

    // Compute a valid recoveryKeyHash (32-byte BLAKE2b hash of 32 random bytes)
    const rawKeyBytes = crypto.randomBytes(32);
    const recoveryKeyHashHex = toHex(hashRecoveryKey(rawKeyBytes));

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      headers: authHeaders,
      data: {
        authKey: authKeyHex,
        newRecoveryEncryptedMasterKey: serializePayloadHex(newRecovery.encryptedMasterKey),
        recoveryKeyHash: recoveryKeyHashHex,
        confirmed: true,
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);

    // Verify recovery key is still reported as active
    const statusRes = await request.get("/v1/auth/recovery-key/status", {
      headers: authHeaders,
    });
    expect(statusRes.status()).toBe(200);
    const statusBody = (await statusRes.json()) as {
      data: { hasActiveKey: boolean };
    };
    expect(statusBody.data.hasActiveKey).toBe(true);
  });

  test("returns 401 without auth", async ({ request }) => {
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeRecoveryKeyHashHex = crypto.randomBytes(32).toString("hex");

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      data: {
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: fakeEncryptedMasterKey,
        recoveryKeyHash: fakeRecoveryKeyHashHex,
        confirmed: true,
      },
    });

    expect(res.status()).toBe(401);
  });

  test("returns 400 with wrong auth key", async ({ request, authHeaders }) => {
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeRecoveryKeyHashHex = crypto.randomBytes(32).toString("hex");

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      headers: authHeaders,
      data: {
        authKey: "0".repeat(64),
        newRecoveryEncryptedMasterKey: fakeEncryptedMasterKey,
        recoveryKeyHash: fakeRecoveryKeyHashHex,
        confirmed: true,
      },
    });

    expect(res.status()).toBe(400);
  });

  test("returns 400 when recoveryKeyHash is missing", async ({ request, authHeaders }) => {
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      headers: authHeaders,
      data: {
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: fakeEncryptedMasterKey,
        confirmed: true,
        // recoveryKeyHash intentionally omitted
      },
    });

    expect(res.status()).toBe(400);
  });

  test("returns 400 when recoveryKeyHash has wrong length", async ({ request, authHeaders }) => {
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      headers: authHeaders,
      data: {
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: fakeEncryptedMasterKey,
        recoveryKeyHash: "ab".repeat(16), // 16 bytes = 32 hex chars, but need 32 bytes = 64 hex
        confirmed: true,
      },
    });

    expect(res.status()).toBe(400);
  });

  test("returns 400 when encryptedMasterKey is too short", async ({ request, authHeaders }) => {
    const fakeRecoveryKeyHashHex = crypto.randomBytes(32).toString("hex");

    const res = await request.post("/v1/auth/recovery-key/regenerate", {
      headers: authHeaders,
      data: {
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "aabb", // < 80 hex chars minimum
        recoveryKeyHash: fakeRecoveryKeyHashHex,
        confirmed: true,
      },
    });

    expect(res.status()).toBe(400);
  });
});

test.describe("POST /v1/auth/password-reset/recovery-key", () => {
  // KDF salt is 16 bytes = 32 hex chars; auth key 32 bytes = 64 hex; sig 64 bytes = 128 hex
  test("returns 401 for unknown email (anti-enumeration)", async ({ request }) => {
    const unknownEmail = `unknown-${crypto.randomUUID()}@test.pluralscape.local`;
    const newSaltHex = crypto.randomBytes(16).toString("hex");
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeRecoveryEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeRecoveryKeyHashHex = crypto.randomBytes(32).toString("hex");
    const fakeSigHex = crypto.randomBytes(64).toString("hex");

    const res = await request.post("/v1/auth/password-reset/recovery-key", {
      data: {
        email: unknownEmail,
        newAuthKey: "a".repeat(64),
        newKdfSalt: newSaltHex,
        newEncryptedMasterKey: fakeEncryptedMasterKey,
        newRecoveryEncryptedMasterKey: fakeRecoveryEncryptedMasterKey,
        recoveryKeyHash: fakeRecoveryKeyHashHex,
        challengeSignature: fakeSigHex,
      },
    });

    expect(res.status()).toBe(401);
  });

  test("returns 400 when recoveryKeyHash is missing", async ({ request }) => {
    const fakeEmail = `test-${crypto.randomUUID()}@test.pluralscape.local`;
    const newSaltHex = crypto.randomBytes(16).toString("hex");
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeRecoveryEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeSigHex = crypto.randomBytes(64).toString("hex");

    const res = await request.post("/v1/auth/password-reset/recovery-key", {
      data: {
        email: fakeEmail,
        newAuthKey: "a".repeat(64),
        newKdfSalt: newSaltHex,
        newEncryptedMasterKey: fakeEncryptedMasterKey,
        newRecoveryEncryptedMasterKey: fakeRecoveryEncryptedMasterKey,
        challengeSignature: fakeSigHex,
        // recoveryKeyHash intentionally omitted
      },
    });

    expect(res.status()).toBe(400);
  });

  test("returns 400 when encrypted blobs are too short", async ({ request }) => {
    const fakeEmail = `test-${crypto.randomUUID()}@test.pluralscape.local`;
    const newSaltHex = crypto.randomBytes(16).toString("hex");
    const fakeRecoveryKeyHashHex = crypto.randomBytes(32).toString("hex");
    const fakeSigHex = crypto.randomBytes(64).toString("hex");

    const res = await request.post("/v1/auth/password-reset/recovery-key", {
      data: {
        email: fakeEmail,
        newAuthKey: "a".repeat(64),
        newKdfSalt: newSaltHex,
        newEncryptedMasterKey: "aabb", // < 80 hex chars minimum
        newRecoveryEncryptedMasterKey: "ccdd", // < 80 hex chars minimum
        recoveryKeyHash: fakeRecoveryKeyHashHex,
        challengeSignature: fakeSigHex,
      },
    });

    expect(res.status()).toBe(400);
  });
});
