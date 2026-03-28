import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;

interface DeviceTokenResponse {
  readonly id: string;
  readonly systemId: string;
  readonly platform: string;
  readonly token: string;
  readonly lastActiveAt: number | null;
  readonly createdAt: number;
}

interface DeviceTokenListResponse {
  readonly data: readonly DeviceTokenResponse[];
}

test.describe("Device tokens", () => {
  test("register, list, and revoke lifecycle", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    let tokenId: string;

    await test.step("register a device token", async () => {
      const res = await request.post(`/v1/systems/${systemId}/device-tokens`, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: { platform: "ios", token: "e2e-apns-token-abc" },
      });
      expect(res.status()).toBe(HTTP_CREATED);

      const body = (await res.json()) as DeviceTokenResponse;
      expect(body.id).toMatch(/^dt_/);
      expect(body.platform).toBe("ios");
      expect(body.token).toBe("***oken-abc");
      expect(body.systemId).toBe(systemId);
      tokenId = body.id;
    });

    await test.step("list includes registered token", async () => {
      const res = await request.get(`/v1/systems/${systemId}/device-tokens`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as DeviceTokenListResponse;
      const ids = body.data.map((t) => t.id);
      expect(ids).toContain(tokenId);
    });

    await test.step("revoke the token", async () => {
      const res = await request.post(`/v1/systems/${systemId}/device-tokens/${tokenId}/revoke`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("revoked token excluded from list", async () => {
      const res = await request.get(`/v1/systems/${systemId}/device-tokens`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as DeviceTokenListResponse;
      const ids = body.data.map((t) => t.id);
      expect(ids).not.toContain(tokenId);
    });
  });

  test("rejects invalid platform", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.post(`/v1/systems/${systemId}/device-tokens`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { platform: "blackberry", token: "some-token" },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });

  test("rejects empty token", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.post(`/v1/systems/${systemId}/device-tokens`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { platform: "ios", token: "" },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });
});
