import { assertErrorShape } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

/** authHeavy tier: 5 requests per minute. */
const AUTH_HEAVY_LIMIT = 5;

test.describe("Rate limits: sensitive endpoints", () => {
  test.describe.configure({ timeout: 120_000 });

  test("PIN verify rate limited after burst", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const pinUrl = `/v1/systems/${systemId}/settings/pin/verify`;

    // Detect whether the server has rate limiting enabled
    const probe = await request.post(pinUrl, {
      headers: authHeaders,
      data: { pin: "0000" },
    });
    const hasRateLimiting = probe.headers()["x-ratelimit-limit"] !== undefined;
    test.skip(!hasRateLimiting, "Rate limiting is disabled in this environment");

    for (let i = 1; i < AUTH_HEAVY_LIMIT; i++) {
      await request.post(pinUrl, {
        headers: authHeaders,
        data: { pin: "0000" },
      });
    }

    const res = await request.post(pinUrl, {
      headers: authHeaders,
      data: { pin: "0000" },
    });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });

  test("password change rate limited after burst", async ({ request, authHeaders }) => {
    const passwordUrl = "/v1/account/password";

    // Detect whether the server has rate limiting enabled
    const probe = await request.put(passwordUrl, {
      headers: authHeaders,
      data: {
        currentPassword: "wrong-password",
        newPassword: "NewPassword123!",
      },
    });
    const hasRateLimiting = probe.headers()["x-ratelimit-limit"] !== undefined;
    test.skip(!hasRateLimiting, "Rate limiting is disabled in this environment");

    for (let i = 1; i < AUTH_HEAVY_LIMIT; i++) {
      await request.put(passwordUrl, {
        headers: authHeaders,
        data: {
          currentPassword: "wrong-password",
          newPassword: "NewPassword123!",
        },
      });
    }

    const res = await request.put(passwordUrl, {
      headers: authHeaders,
      data: {
        currentPassword: "wrong-password",
        newPassword: "NewPassword123!",
      },
    });
    expect(res.status()).toBe(429);
    await assertErrorShape(res);
  });
});
