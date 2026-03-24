import { expect, test } from "../../fixtures/auth.fixture.js";

import type { APIRequestContext } from "@playwright/test";

async function getSystemId(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<string> {
  const res = await request.get("/v1/systems", { headers });
  const body = await res.json();
  return body.items[0].id as string;
}

test.describe("Webhook Config Flow", () => {
  test("webhook config lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    let webhookId: string;
    let secret: string;

    await test.step("create webhook config", async () => {
      const res = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/e2e-hook",
          eventTypes: ["fronting.started"],
        },
      });
      expect(res.status()).toBe(201);
      const webhook = await res.json();
      expect(webhook).toHaveProperty("id");
      expect(webhook.secret).toBeTruthy();
      expect(typeof webhook.secret).toBe("string");
      expect(webhook.url).toBe("https://example.com/e2e-hook");
      expect(webhook.eventTypes).toEqual(["fronting.started"]);
      webhookId = webhook.id as string;
      secret = webhook.secret as string;
      expect(secret.length).toBeGreaterThan(0);
    });

    await test.step("get - secret NOT returned", async () => {
      const res = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const webhook = await res.json();
      expect(webhook.id).toBe(webhookId);
      expect(webhook.url).toBe("https://example.com/e2e-hook");
      expect(webhook).not.toHaveProperty("secret");
    });

    await test.step("list includes webhook", async () => {
      const res = await request.get(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const ids = (body.items as { id: string }[]).map((w) => w.id);
      expect(ids).toContain(webhookId);
    });

    await test.step("update URL", async () => {
      const res = await request.put(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/e2e-hook-updated",
          version: 1,
        },
      });
      expect(res.status()).toBe(200);
      const webhook = await res.json();
      expect(webhook.url).toBe("https://example.com/e2e-hook-updated");
    });

    await test.step("archive", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/webhook-configs/${webhookId}/archive`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(204);
    });

    await test.step("restore", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/webhook-configs/${webhookId}/restore`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const res = await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("verify deleted", async () => {
      const res = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });
});
