import crypto from "node:crypto";

import { assertErrorShape, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import {
  HTTP_BAD_REQUEST,
  HTTP_NO_CONTENT,
  HTTP_UNAUTHORIZED,
} from "../../fixtures/http.constants.js";

import type { APIRequestContext } from "@playwright/test";

/**
 * Register a "viewer" account which has no auto-created system.
 *
 * The account deletion CASCADE interacts with RLS on the systems table,
 * so we use a viewer account (no systems) to test the happy path cleanly.
 */
async function registerViewerAccount(
  request: APIRequestContext,
): Promise<{ email: string; password: string; sessionToken: string }> {
  const uuid = crypto.randomUUID();
  const email = `e2e-del-${uuid}@test.pluralscape.local`;
  const password = `E2E-Pass-${uuid}`;
  const res = await request.post("/v1/auth/register", {
    data: { email, password, recoveryKeyBackupConfirmed: true, accountType: "viewer" },
  });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { sessionToken: string } };
  return { email, password, sessionToken: body.data.sessionToken };
}

test.describe("Account deletion", () => {
  test("DELETE /v1/account deletes account with password confirmation", async ({ request }) => {
    const acct = await registerViewerAccount(request);
    const headers = { Authorization: `Bearer ${acct.sessionToken}` };

    const before = await request.get("/v1/account", { headers });
    expect(before.ok()).toBe(true);

    const res = await request.delete("/v1/account", {
      headers,
      data: { password: acct.password },
    });
    expect(res.status()).toBe(HTTP_NO_CONTENT);

    const after = await request.get("/v1/account", { headers });
    expect(after.status()).toBe(HTTP_UNAUTHORIZED);
  });

  test("DELETE /v1/account rejects wrong password", async ({ request, authHeaders }) => {
    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: { password: "wrong-password-here" },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    await assertErrorShape(res);
  });

  test("DELETE /v1/account rejects missing password", async ({ request, authHeaders }) => {
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
    const acct = await registerViewerAccount(request);
    const headers = { Authorization: `Bearer ${acct.sessionToken}` };

    const del = await request.delete("/v1/account", {
      headers,
      data: { password: acct.password },
    });
    expect(del.status()).toBe(HTTP_NO_CONTENT);

    const login = await request.post("/v1/auth/login", {
      data: { email: acct.email, password: acct.password },
    });
    expect(login.status()).toBe(HTTP_UNAUTHORIZED);
  });
});
