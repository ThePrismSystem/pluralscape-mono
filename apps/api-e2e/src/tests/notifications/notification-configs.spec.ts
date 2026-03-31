import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_BAD_REQUEST } from "../../fixtures/http.constants.js";

interface NotificationConfigResponse {
  readonly id: string;
  readonly systemId: string;
  readonly eventType: string;
  readonly enabled: boolean;
  readonly pushEnabled: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface NotificationConfigListResponse {
  readonly data: readonly NotificationConfigResponse[];
}

test.describe("Notification configs", () => {
  test("list returns empty initially, update creates and persists", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);

    await test.step("list initially empty", async () => {
      const res = await request.get(`/v1/systems/${systemId}/notification-configs`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as NotificationConfigListResponse;
      expect(body.data).toHaveLength(0);
    });

    await test.step("update creates config and disables", async () => {
      const res = await request.patch(
        `/v1/systems/${systemId}/notification-configs/friend-switch-alert`,
        {
          headers: { ...authHeaders, "Content-Type": "application/json" },
          data: { enabled: false },
        },
      );
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as { data: NotificationConfigResponse };
      expect(body.data.eventType).toBe("friend-switch-alert");
      expect(body.data.enabled).toBe(false);
      expect(body.data.pushEnabled).toBe(true);
    });

    await test.step("list includes updated config", async () => {
      const res = await request.get(`/v1/systems/${systemId}/notification-configs`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as NotificationConfigListResponse;
      expect(body.data).toHaveLength(1);
      const config = body.data[0];
      expect(config?.eventType).toBe("friend-switch-alert");
      expect(config?.enabled).toBe(false);
    });
  });

  test("rejects invalid event type", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.patch(
      `/v1/systems/${systemId}/notification-configs/nonexistent-event`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: { enabled: false },
      },
    );
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });

  test("rejects empty body", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.patch(
      `/v1/systems/${systemId}/notification-configs/friend-switch-alert`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: {},
      },
    );
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
  });
});
