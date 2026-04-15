import { assertErrorShape, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import {
  HTTP_BAD_REQUEST,
  HTTP_NO_CONTENT,
  HTTP_UNAUTHORIZED,
} from "../../fixtures/http.constants.js";
import { registerAccount } from "../../helpers/register.js";

import type { APIRequestContext } from "@playwright/test";

/**
 * Register a fresh account and return credentials including the derived authKey.
 */
async function registerDeletableAccount(
  request: APIRequestContext,
): Promise<{ email: string; authKeyHex: string; sessionToken: string }> {
  const acct = await registerAccount(request, { emailPrefix: "e2e-del" });
  return { email: acct.email, authKeyHex: acct.authKeyHex, sessionToken: acct.sessionToken };
}

test.describe("Account deletion", () => {
  test("DELETE /v1/account deletes account with authKey confirmation", async ({ request }) => {
    const acct = await registerDeletableAccount(request);
    const headers = { Authorization: `Bearer ${acct.sessionToken}` };

    const before = await request.get("/v1/account", { headers });
    expect(before.ok()).toBe(true);

    const res = await request.delete("/v1/account", {
      headers,
      data: { authKey: acct.authKeyHex },
    });
    expect(res.status()).toBe(HTTP_NO_CONTENT);

    const after = await request.get("/v1/account", { headers });
    expect(after.status()).toBe(HTTP_UNAUTHORIZED);
  });

  test("DELETE /v1/account rejects wrong authKey", async ({ request, authHeaders }) => {
    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: { authKey: "0".repeat(64) },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    await assertErrorShape(res);
  });

  test("DELETE /v1/account rejects missing authKey", async ({ request, authHeaders }) => {
    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: {},
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    await assertErrorShape(res);
  });

  test("DELETE /v1/account requires auth", async ({ request }) => {
    await assertRequiresAuth(request, "DELETE", "/v1/account");
  });

  test("DELETE /v1/account cascades to auth data", async ({ request }) => {
    const acct = await registerDeletableAccount(request);
    const headers = { Authorization: `Bearer ${acct.sessionToken}` };

    const del = await request.delete("/v1/account", {
      headers,
      data: { authKey: acct.authKeyHex },
    });
    expect(del.status()).toBe(HTTP_NO_CONTENT);

    // Login with authKey should fail after account deletion
    const login = await request.post("/v1/auth/login", {
      data: { email: acct.email, authKey: acct.authKeyHex },
    });
    expect(login.status()).toBe(HTTP_UNAUTHORIZED);
  });
});
