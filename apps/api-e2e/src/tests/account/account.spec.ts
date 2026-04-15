import crypto from "node:crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";
import { HTTP_BAD_REQUEST } from "../../fixtures/http.constants.js";

test.describe("Account endpoints", () => {
  test("GET /v1/account returns account info", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/account", { headers: authHeaders });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data.accountId");
    expect(body).toHaveProperty("data.accountType");
  });

  test("GET /v1/account without auth returns 401", async ({ request }) => {
    const res = await request.get("/v1/account");
    expect(res.status()).toBe(401);
  });

  test("PUT /v1/account/password rejects incorrect old auth key", async ({
    request,
    authHeaders,
  }) => {
    const fakeNewKdfSalt = crypto.randomBytes(16).toString("hex");
    const fakeEncryptedMasterKey = crypto.randomBytes(80).toString("hex");
    const fakeSig = crypto.randomBytes(64).toString("hex");

    const res = await request.put("/v1/account/password", {
      headers: authHeaders,
      data: {
        oldAuthKey: "0".repeat(64),
        newAuthKey: "a".repeat(64),
        newKdfSalt: fakeNewKdfSalt,
        newEncryptedMasterKey: fakeEncryptedMasterKey,
        challengeSignature: fakeSig,
      },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });

  test("PUT /v1/account/password rejects missing fields", async ({ request, authHeaders }) => {
    const res = await request.put("/v1/account/password", {
      headers: authHeaders,
      data: {},
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });
});
