import { expect, test } from "@playwright/test";

import { E2E_CROWDIN_FIXTURES } from "../crowdin-stub-lifecycle.js";
import {
  HTTP_BAD_GATEWAY,
  HTTP_NOT_FOUND,
  HTTP_NOT_MODIFIED,
  HTTP_OK,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
} from "../fixtures/http.constants.js";

/**
 * Precise-contract E2E for the i18n OTA proxy.
 *
 * globalSetup spawns a local Crowdin OTA stub and wires the API process to it
 * via `CROWDIN_OTA_BASE_URL` + `CROWDIN_DISTRIBUTION_HASH`. That lets this
 * suite assert against concrete response shapes instead of accepting the
 * union of "maybe-up, maybe-down" statuses that a live-CDN dependency forced.
 *
 * Fixture contents and the distribution hash come from `crowdin-stub-lifecycle`
 * so the server-side fixture and the client-side assertions stay in sync.
 */

const I18N_FETCH_LIMIT = 30;
const BURST_COUNT = 35;
const BURST_TAIL = 5;
const ETAG_PATTERN = /^"[0-9a-f]{16}"$/;

test.describe("GET /v1/i18n/*", () => {
  test("manifest endpoint returns the expected envelope", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as {
      data: {
        distributionTimestamp: number;
        locales: { locale: string; namespaces: { name: string }[] }[];
      };
    };
    expect(body.data.distributionTimestamp).toBe(E2E_CROWDIN_FIXTURES.manifest.timestamp);
    // Locale list must match the stub's manifest — order is preserved by the
    // route so a deep-equal check is safe.
    const locales = body.data.locales.map((l) => l.locale).sort();
    expect(locales).toEqual(Object.keys(E2E_CROWDIN_FIXTURES.manifest.content).sort());
  });

  test("manifest endpoint does not require authentication", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    expect(res.status()).not.toBe(HTTP_UNAUTHORIZED);
  });

  test("namespace endpoint returns translations with an ETag and Cache-Control", async ({
    request,
  }) => {
    const res = await request.get("/v1/i18n/es/common");
    expect(res.status()).toBe(HTTP_OK);
    expect(res.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
    const etag = res.headers()["etag"];
    expect(etag).toMatch(ETAG_PATTERN);
    const body = (await res.json()) as { data: { translations: Record<string, string> } };
    expect(body.data.translations).toEqual(E2E_CROWDIN_FIXTURES.namespaces["es/common"]);
  });

  test("returns 304 on matching If-None-Match", async ({ request }) => {
    const first = await request.get("/v1/i18n/en/common");
    const etag = first.headers()["etag"];
    expect(etag).toMatch(ETAG_PATTERN);
    if (etag === undefined) throw new Error("precondition: ETag header must be set on first GET");
    const second = await request.get("/v1/i18n/en/common", {
      headers: { "if-none-match": etag },
    });
    expect(second.status()).toBe(HTTP_NOT_MODIFIED);
    expect(await second.text()).toBe("");
  });

  test("returns fresh body on mismatched If-None-Match", async ({ request }) => {
    await request.get("/v1/i18n/en/common");
    const res = await request.get("/v1/i18n/en/common", {
      headers: { "if-none-match": '"deadbeefdeadbeef"' },
    });
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as { data: { translations: Record<string, string> } };
    expect(body.data.translations).toEqual(E2E_CROWDIN_FIXTURES.namespaces["en/common"]);
  });

  test("returns 404 when the upstream has no such namespace", async ({ request }) => {
    const res = await request.get("/v1/i18n/xx/missing");
    expect(res.status()).toBe(HTTP_NOT_FOUND);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NAMESPACE_NOT_FOUND");
  });

  test("returns 502 when the upstream returns a 5xx", async ({ request }) => {
    // The stub's `upstreamStatusFor` maps /content/zz/broken.json → 500.
    // `zz` is a BCP-47-shaped locale that passes route-level validation
    // but hits the stub's forced-5xx branch.
    const res = await request.get("/v1/i18n/zz/broken");
    expect(res.status()).toBe(HTTP_BAD_GATEWAY);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  test("exposes i18nFetch rate-limit headers when enabled", async ({ request }) => {
    const res = await request.get("/v1/i18n/manifest");
    const limit = res.headers()["x-ratelimit-limit"];
    test.skip(limit === undefined, "Rate limiting is disabled in this environment");
    expect(limit).toBe(String(I18N_FETCH_LIMIT));
  });

  test("burst of requests to manifest triggers 429 on the tail", async ({ request }) => {
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
