import { expect } from "@playwright/test";

import { assertErrorShape } from "../../fixtures/assertions.js";
import { test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Error response shape verification", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("401 has standard error envelope", async ({ request }) => {
    const res = await request.get("/v1/account");
    expect(res.status()).toBe(401);
    await assertErrorShape(res);
  });

  test("404 has standard error envelope", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems/sys_00000000-0000-0000-0000-000000000099", {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
    await assertErrorShape(res);
  });

  test("400 validation error has standard envelope", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.post(`/v1/systems/${systemId}/members`, {
      headers: authHeaders,
      data: { invalid: "payload" },
    });
    expect(res.status()).toBe(400);
    await assertErrorShape(res);
  });

  test("error responses do not leak stack traces", async ({ request }) => {
    const res = await request.get("/v1/account");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("at ");
    expect(bodyStr).not.toContain(".ts:");
    expect(bodyStr).not.toContain("/home/");
    expect(bodyStr).not.toContain("node_modules");
  });

  test("error responses include requestId", async ({ request }) => {
    const res = await request.get("/v1/account");
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toBeTruthy();
    expect(typeof body.requestId).toBe("string");
  });
});
