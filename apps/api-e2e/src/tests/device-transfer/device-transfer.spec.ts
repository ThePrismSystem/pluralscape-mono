import crypto from "node:crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";

/**
 * Generate a valid code salt (16 bytes) and a minimal encrypted payload (40 bytes = 24 nonce + 16 tag).
 * These are hex-encoded for the API request body.
 */
function generateTestTransferPayload(): {
  codeSaltHex: string;
  encryptedKeyMaterialHex: string;
} {
  const codeSalt = crypto.randomBytes(16);
  const encryptedKeyMaterial = crypto.randomBytes(40);
  return {
    codeSaltHex: codeSalt.toString("hex"),
    encryptedKeyMaterialHex: encryptedKeyMaterial.toString("hex"),
  };
}

// Argon2id worker pool cold-starts on first completeTransfer call (loads libsodium WASM)
test.describe.configure({ timeout: 60_000 });

test.describe("Device transfer endpoints", () => {
  test("POST /v1/account/device-transfer initiates a transfer", async ({
    request,
    authHeaders,
  }) => {
    const payload = generateTestTransferPayload();
    const res = await request.post("/v1/account/device-transfer", {
      headers: authHeaders,
      data: payload,
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("transferId");
    expect(body).toHaveProperty("expiresAt");
    expect(typeof body.transferId).toBe("string");
    expect(typeof body.expiresAt).toBe("number");
  });

  test("POST /v1/account/device-transfer without auth returns 401", async ({ request }) => {
    const payload = generateTestTransferPayload();
    const res = await request.post("/v1/account/device-transfer", {
      data: payload,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /v1/account/device-transfer/:id/complete with wrong code returns 401", async ({
    request,
    authHeaders,
  }) => {
    // First initiate a transfer
    const payload = generateTestTransferPayload();
    const initRes = await request.post("/v1/account/device-transfer", {
      headers: authHeaders,
      data: payload,
    });
    expect(initRes.status()).toBe(201);
    const { transferId } = (await initRes.json()) as { transferId: string };

    // Try to complete with wrong code
    const completeRes = await request.post(`/v1/account/device-transfer/${transferId}/complete`, {
      headers: authHeaders,
      data: { code: "00000000" },
    });
    expect(completeRes.status()).toBe(401);
  });

  test("POST /v1/account/device-transfer/:id/complete with non-existent ID returns 404", async ({
    request,
    authHeaders,
  }) => {
    const res = await request.post("/v1/account/device-transfer/dtr_nonexistent/complete", {
      headers: authHeaders,
      data: { code: "12345678" },
    });
    expect(res.status()).toBe(404);
  });

  test("5 wrong codes locks the transfer", async ({ request, authHeaders }) => {
    // Initiate a transfer
    const payload = generateTestTransferPayload();
    const initRes = await request.post("/v1/account/device-transfer", {
      headers: authHeaders,
      data: payload,
    });
    expect(initRes.status()).toBe(201);
    const { transferId } = (await initRes.json()) as { transferId: string };

    // Try 5 wrong codes
    for (let i = 0; i < 5; i++) {
      const res = await request.post(`/v1/account/device-transfer/${transferId}/complete`, {
        headers: authHeaders,
        data: { code: "00000000" },
      });
      expect(res.status()).toBe(401);
    }

    // 6th attempt should also fail (transfer is now expired)
    const finalRes = await request.post(`/v1/account/device-transfer/${transferId}/complete`, {
      headers: authHeaders,
      data: { code: "00000000" },
    });
    // Transfer is expired, query returns no pending row → 404
    expect(finalRes.status()).toBe(404);
  });
});
