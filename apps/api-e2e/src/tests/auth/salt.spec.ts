import crypto from "node:crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";

test.describe("POST /v1/auth/salt", () => {
  test("returns kdfSalt for a registered account", async ({ request, registeredAccount }) => {
    const res = await request.post("/v1/auth/salt", {
      data: { email: registeredAccount.email },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data.kdfSalt");
    expect(typeof body.data.kdfSalt).toBe("string");
    // KDF salt is 16 bytes = 32 hex chars
    expect(body.data.kdfSalt).toMatch(/^[0-9a-f]{32}$/i);
  });

  test("returns a deterministic fake salt for non-existing emails", async ({ request }) => {
    const unknownEmail = `nonexistent-${crypto.randomUUID()}@test.pluralscape.local`;

    const res1 = await request.post("/v1/auth/salt", {
      data: { email: unknownEmail },
    });
    const res2 = await request.post("/v1/auth/salt", {
      data: { email: unknownEmail },
    });

    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);

    const body1 = (await res1.json()) as { data: { kdfSalt: string } };
    const body2 = (await res2.json()) as { data: { kdfSalt: string } };

    expect(body1.data.kdfSalt).toBe(body2.data.kdfSalt);
    expect(body1.data.kdfSalt).toMatch(/^[0-9a-f]{32}$/i);
  });

  test("returns different fake salts for different unknown emails", async ({ request }) => {
    const email1 = `unknown-a-${crypto.randomUUID()}@test.pluralscape.local`;
    const email2 = `unknown-b-${crypto.randomUUID()}@test.pluralscape.local`;

    const [res1, res2] = await Promise.all([
      request.post("/v1/auth/salt", { data: { email: email1 } }),
      request.post("/v1/auth/salt", { data: { email: email2 } }),
    ]);

    const body1 = (await res1.json()) as { data: { kdfSalt: string } };
    const body2 = (await res2.json()) as { data: { kdfSalt: string } };

    expect(body1.data.kdfSalt).not.toBe(body2.data.kdfSalt);
  });

  test("returns 400 for missing email field", async ({ request }) => {
    const res = await request.post("/v1/auth/salt", {
      data: {},
    });

    expect(res.status()).toBe(400);
  });

  test("returns 400 for invalid email format", async ({ request }) => {
    const res = await request.post("/v1/auth/salt", {
      data: { email: "not-an-email" },
    });

    expect(res.status()).toBe(400);
  });
});
