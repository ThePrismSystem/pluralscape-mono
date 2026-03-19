import crypto from "node:crypto";

import { expect, test } from "@playwright/test";

test.describe("POST /v1/auth/register", () => {
  test("registers a new account and returns session data", async ({ request }) => {
    const email = `e2e-${crypto.randomUUID()}@test.pluralscape.local`;
    const res = await request.post("/v1/auth/register", {
      data: {
        email,
        password: "ValidPassword123!",
        recoveryKeyBackupConfirmed: true,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("sessionToken");
    expect(body).toHaveProperty("recoveryKey");
    expect(body).toHaveProperty("accountId");
    expect(body.accountType).toBe("system");
    expect(body.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("rejects registration with missing fields", async ({ request }) => {
    const res = await request.post("/v1/auth/register", {
      data: {},
    });

    expect(res.status()).toBe(400);
  });

  test("rejects registration with short password", async ({ request }) => {
    const res = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-${crypto.randomUUID()}@test.pluralscape.local`,
        password: "short",
        recoveryKeyBackupConfirmed: true,
      },
    });

    expect(res.status()).toBe(400);
  });

  test("duplicate email returns fake 201 (anti-enumeration)", async ({ request }) => {
    const email = `e2e-${crypto.randomUUID()}@test.pluralscape.local`;
    const body = {
      email,
      password: "ValidPassword123!",
      recoveryKeyBackupConfirmed: true,
    };

    const first = await request.post("/v1/auth/register", { data: body });
    expect(first.status()).toBe(201);

    // Anti-enumeration: duplicate registration returns fake success
    // (attacker cannot distinguish "email taken" from "new account")
    const second = await request.post("/v1/auth/register", { data: body });
    expect(second.status()).toBe(201);
    const secondBody = await second.json();
    expect(secondBody).toHaveProperty("sessionToken");
    expect(secondBody).toHaveProperty("recoveryKey");
  });
});
