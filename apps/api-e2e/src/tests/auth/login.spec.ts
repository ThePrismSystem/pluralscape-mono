import { expect, test } from "../../fixtures/auth.fixture.js";

test.describe("POST /v1/auth/login", () => {
  test("logs in with valid credentials", async ({ request, registeredAccount }) => {
    const res = await request.post("/v1/auth/login", {
      data: {
        email: registeredAccount.email,
        password: registeredAccount.password,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data.sessionToken");
    expect(body).toHaveProperty("data.accountId");
    expect(body).toHaveProperty("data.systemId");
    expect(body.data.accountType).toBe("system");
    expect(body.data.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("rejects wrong password with 401", async ({ request, registeredAccount }) => {
    const res = await request.post("/v1/auth/login", {
      data: {
        email: registeredAccount.email,
        password: "WrongPassword999!",
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("rejects unknown email with same 401 message", async ({ request }) => {
    const res = await request.post("/v1/auth/login", {
      data: {
        email: "nonexistent@test.pluralscape.local",
        password: "AnyPassword123!",
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    // Same error code for both wrong password and unknown email (no enumeration)
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
