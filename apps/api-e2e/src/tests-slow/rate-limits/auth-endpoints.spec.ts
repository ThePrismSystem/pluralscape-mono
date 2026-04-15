import { assertErrorShape } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";

/** authHeavy tier: 5 requests per minute. */
const AUTH_HEAVY_LIMIT = 5;

test.describe("Rate limits: auth endpoints", () => {
  test.describe.configure({ timeout: 120_000 });

  test("login rate limited after burst", async ({ request }) => {
    const badCredentials = { email: "rate-limit@test.local", authKey: "0".repeat(64) };

    // Detect whether the server has rate limiting enabled
    const probe = await request.post("/v1/auth/login", { data: badCredentials });
    const hasRateLimiting = probe.headers()["x-ratelimit-limit"] !== undefined;
    test.skip(!hasRateLimiting, "Rate limiting is disabled in this environment");

    // First probe already counted; send remaining to fill the bucket
    for (let i = 1; i < AUTH_HEAVY_LIMIT; i++) {
      await request.post("/v1/auth/login", { data: badCredentials });
    }

    const res = await request.post("/v1/auth/login", { data: badCredentials });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });

  test("register rate limited after burst", async ({ request }) => {
    // Detect whether the server has rate limiting enabled
    const probe = await request.post("/v1/auth/register/initiate", {
      data: { email: "rl-probe@test.local" },
    });
    const hasRateLimiting = probe.headers()["x-ratelimit-limit"] !== undefined;
    test.skip(!hasRateLimiting, "Rate limiting is disabled in this environment");

    for (let i = 1; i < AUTH_HEAVY_LIMIT; i++) {
      await request.post("/v1/auth/register/initiate", {
        data: { email: `rl-${String(i)}@test.local` },
      });
    }

    const res = await request.post("/v1/auth/register/initiate", {
      data: { email: "rl-final@test.local" },
    });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });
});
