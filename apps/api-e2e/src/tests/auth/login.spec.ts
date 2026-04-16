import {
  assertPwhashSalt,
  deriveAuthAndPasswordKeys,
  fromHex,
  initSodium,
  toHex,
} from "@pluralscape/crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";

import type { APIRequestContext } from "@playwright/test";

/**
 * Retrieve the kdfSalt for an account and derive the authKey from the password.
 */
async function deriveAuthKeyForLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  await initSodium();
  const saltRes = await request.post("/v1/auth/salt", { data: { email } });
  const saltBody = (await saltRes.json()) as { data: { kdfSalt: string } };
  const saltBytes = fromHex(saltBody.data.kdfSalt);
  assertPwhashSalt(saltBytes);
  const passwordBytes = new TextEncoder().encode(password);
  const { authKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
  return toHex(authKey);
}

test.describe("POST /v1/auth/login", () => {
  test("logs in with valid credentials", async ({ request, registeredAccount }) => {
    const authKeyHex = await deriveAuthKeyForLogin(
      request,
      registeredAccount.email,
      registeredAccount.password,
    );

    const res = await request.post("/v1/auth/login", {
      data: {
        email: registeredAccount.email,
        authKey: authKeyHex,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data.sessionToken");
    expect(body).toHaveProperty("data.accountId");
    expect(body).toHaveProperty("data.systemId");
    expect((body as { data: { accountType: string } }).data.accountType).toBe("system");
    expect((body as { data: { sessionToken: string } }).data.sessionToken).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  test("rejects wrong authKey with 401", async ({ request, registeredAccount }) => {
    const res = await request.post("/v1/auth/login", {
      data: {
        email: registeredAccount.email,
        authKey: "0".repeat(64),
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect((body as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  });

  test("rejects unknown email with same 401 message", async ({ request }) => {
    const res = await request.post("/v1/auth/login", {
      data: {
        email: "nonexistent@test.pluralscape.local",
        authKey: "a".repeat(64),
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    // Same error code for both wrong authKey and unknown email (no enumeration)
    expect((body as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  });
});
