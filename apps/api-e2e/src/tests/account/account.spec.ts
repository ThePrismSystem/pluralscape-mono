import { expect, test } from "../../fixtures/auth.fixture.js";

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

  test("PUT /v1/account/password changes password", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const newPassword = "NewSecurePassword456!";

    const res = await request.put("/v1/account/password", {
      headers: authHeaders,
      data: {
        currentPassword: registeredAccount.password,
        newPassword,
      },
    });
    expect(res.status()).toBe(200);

    // Verify old password no longer works for login
    const loginOld = await request.post("/v1/auth/login", {
      data: { email: registeredAccount.email, password: registeredAccount.password },
    });
    expect(loginOld.status()).toBe(401);

    // Verify new password works
    const loginNew = await request.post("/v1/auth/login", {
      data: { email: registeredAccount.email, password: newPassword },
    });
    expect(loginNew.status()).toBe(200);
  });
});
