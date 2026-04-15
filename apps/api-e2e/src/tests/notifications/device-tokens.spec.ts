import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_BAD_REQUEST, HTTP_CREATED, HTTP_NO_CONTENT } from "../../fixtures/http.constants.js";

interface DeviceTokenResponse {
  readonly id: string;
  readonly systemId: string;
  readonly platform: string;
  readonly tokenHash: string;
  readonly lastActiveAt: number | null;
  readonly createdAt: number;
}

interface DeviceTokenListResponse {
  readonly data: readonly DeviceTokenResponse[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount: number | null;
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

      const body = (await res.json()) as { data: DeviceTokenResponse };
      expect(body.data.id).toMatch(/^dt_/);
      expect(body.data.platform).toBe("ios");
      expect(body.data.tokenHash).toMatch(/^[0-9a-f]{128}$/);
      expect(body.data.systemId).toBe(systemId);
      tokenId = body.data.id;
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

  test("update a device token", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const createRes = await request.post(`/v1/systems/${systemId}/device-tokens`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { platform: "ios", token: "e2e-update-token-abc" },
    });
    expect(createRes.status()).toBe(HTTP_CREATED);
    const tokenId = ((await createRes.json()) as { data: { id: string } }).data.id;

    const updateRes = await request.put(`/v1/systems/${systemId}/device-tokens/${tokenId}`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { platform: "ios", token: "e2e-updated-token-xyz" },
    });
    expect(updateRes.ok()).toBe(true);
  });

  test("delete a device token", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const createRes = await request.post(`/v1/systems/${systemId}/device-tokens`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { platform: "android", token: "e2e-delete-token-def" },
    });
    const tokenId = ((await createRes.json()) as { data: { id: string } }).data.id;

    const deleteRes = await request.delete(`/v1/systems/${systemId}/device-tokens/${tokenId}`, {
      headers: authHeaders,
    });
    expect(deleteRes.status()).toBe(HTTP_NO_CONTENT);

    const listRes = await request.get(`/v1/systems/${systemId}/device-tokens`, {
      headers: authHeaders,
    });
    const body = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((t) => t.id)).not.toContain(tokenId);
  });
});
