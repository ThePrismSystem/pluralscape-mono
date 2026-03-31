import { assertErrorShape } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";

/** authHeavy tier: 5 requests per minute. */
const AUTH_HEAVY_LIMIT = 5;

test.describe("Rate limits: auth endpoints", () => {
  test.describe.configure({ timeout: 120_000 });

  test("login rate limited after burst", async ({ request }) => {
    const badCredentials = { email: "rate-limit@test.local", password: "wrong" };

    for (let i = 0; i < AUTH_HEAVY_LIMIT; i++) {
      await request.post("/v1/auth/login", { data: badCredentials });
    }

    const res = await request.post("/v1/auth/login", { data: badCredentials });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });

  test("register rate limited after burst", async ({ request }) => {
    for (let i = 0; i < AUTH_HEAVY_LIMIT; i++) {
      await request.post("/v1/auth/register", {
        data: { email: `rl-${String(i)}@test.local`, password: "short" },
      });
    }

    const res = await request.post("/v1/auth/register", {
      data: { email: "rl-final@test.local", password: "short" },
    });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });
});
