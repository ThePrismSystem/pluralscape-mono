import { expect, test } from "../../fixtures/auth.fixture.js";

test.describe("Session management", () => {
  test("GET /v1/auth/sessions lists active sessions", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/auth/sessions", { headers: authHeaders });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sessions");
    expect(body.sessions.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /v1/auth/logout invalidates the session", async ({ request, registeredAccount }) => {
    const headers = { Authorization: `Bearer ${registeredAccount.sessionToken}` };

    const logout = await request.post("/v1/auth/logout", { headers });
    expect(logout.status()).toBe(204);

    // Subsequent authenticated request should fail
    const check = await request.get("/v1/auth/sessions", { headers });
    expect(check.status()).toBe(401);
  });
});
