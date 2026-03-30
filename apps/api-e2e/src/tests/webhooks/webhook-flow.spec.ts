import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

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
      const body = (await res.json()) as {
        data: { id: string; secret: string; url: string; eventTypes: string[] };
      };
      expect(body.data).toHaveProperty("id");
      expect(body.data.secret).toBeTruthy();
      expect(typeof body.data.secret).toBe("string");
      expect(body.data.url).toBe("https://example.com/e2e-hook");
      expect(body.data.eventTypes).toEqual(["fronting.started"]);
      webhookId = body.data.id;
      secret = body.data.secret;
      expect(secret.length).toBeGreaterThan(0);
    });

    await test.step("get - secret NOT returned", async () => {
      const res = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { data: { id: string; url: string } };
      expect(body.data.id).toBe(webhookId);
      expect(body.data.url).toBe("https://example.com/e2e-hook");
      expect(body.data).not.toHaveProperty("secret");
    });

    await test.step("list includes webhook", async () => {
      const res = await request.get(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const ids = (body.data as { id: string }[]).map((w) => w.id);
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
      const body = (await res.json()) as { data: { url: string } };
      expect(body.data.url).toBe("https://example.com/e2e-hook-updated");
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
