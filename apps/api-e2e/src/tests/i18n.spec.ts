import { expect, test } from "@playwright/test";

import {
  HTTP_BAD_GATEWAY,
  HTTP_NOT_MODIFIED,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
} from "../fixtures/http.constants.js";

/**
 * i18nFetch rate-limit category: 30 req/min per IP. The burst assertion aims
 * to prove the limiter is wired up — it only runs when rate limiting is
 * enabled for the E2E harness (global-setup currently sets
 * DISABLE_RATE_LIMIT=1 so the burst test is skipped by default).
 */
const I18N_FETCH_LIMIT = 30;
const BURST_COUNT = 35;
const BURST_TAIL = 5;

test.describe("i18n OTA proxy", () => {
  test("manifest endpoint responds with an expected status", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    // Without CROWDIN_DISTRIBUTION_HASH configured in the E2E env the proxy
    // returns 503 NOT_CONFIGURED. In a live environment with Crowdin reachable
    // it returns 200; transient Crowdin failures surface as 502.
    expect([HTTP_OK, HTTP_BAD_GATEWAY, HTTP_SERVICE_UNAVAILABLE]).toContain(res.status());
  });

  test("manifest endpoint does not require authentication", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    expect(res.status()).not.toBe(HTTP_UNAUTHORIZED);
  });

  test("manifest exposes i18nFetch rate-limit headers when enabled", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    const limit = res.headers()["x-ratelimit-limit"];
    test.skip(limit === undefined, "Rate limiting is disabled in this environment");
    expect(limit).toBe(String(I18N_FETCH_LIMIT));
  });

  test("namespace endpoint responds with an expected status", async ({ request }) => {
    const res = await request.get("/v1/i18n/en/common");
    expect([HTTP_OK, HTTP_NOT_MODIFIED, HTTP_BAD_GATEWAY, HTTP_SERVICE_UNAVAILABLE]).toContain(
      res.status(),
    );
  });

  test("burst of requests to manifest triggers 429 on the tail", async ({ request }) => {
    // Detect whether the harness has rate limiting enabled; if not, skip.
    const probe = await request.get("/v1/i18n/manifest");
    const hasRateLimiting = probe.headers()["x-ratelimit-limit"] !== undefined;
    test.skip(!hasRateLimiting, "Rate limiting is disabled in this environment");

    const results: number[] = [probe.status()];
    for (let i = 1; i < BURST_COUNT; i++) {
      const res = await request.get("/v1/i18n/manifest");
      results.push(res.status());
    }

    const tail = results.slice(-BURST_TAIL);
    expect(tail.some((s) => s === HTTP_TOO_MANY_REQUESTS)).toBe(true);
  });
});
