import { expect, test } from "../../fixtures/auth.fixture.js";

interface SessionRow {
  id: string;
  createdAt: number;
  lastActive: number | null;
  expiresAt: number | null;
  encryptedData: string | null;
}

interface SessionListBody {
  data: {
    sessions: SessionRow[];
    nextCursor: string | null;
  };
}

test.describe("Session management", () => {
  test("GET /v1/auth/sessions lists active sessions", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/auth/sessions", { headers: authHeaders });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as SessionListBody;
    expect(body).toHaveProperty("data");
    expect(body.data.sessions.length).toBeGreaterThanOrEqual(1);
  });

  test("session-list response carries encryptedData field for DeviceInfo decryption", async ({
    request,
    authHeaders,
  }) => {
    const res = await request.get("/v1/auth/sessions", { headers: authHeaders });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as SessionListBody;
    const first = body.data.sessions[0];
    expect(first).toBeDefined();
    expect(first).toHaveProperty("encryptedData");
    // No login flow currently writes encryptedData, so the value is null.
    // Once the mobile/web sign-in flow plumbs DeviceInfo through, this field
    // will carry a base64 T1 ciphertext blob decryptable via decryptDeviceInfo.
    expect(first?.encryptedData).toBeNull();
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
