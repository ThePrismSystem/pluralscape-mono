import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_OK, parseJsonBody, pollUntil } from "../../fixtures/http.constants.js";

test.describe("Webhook delivery retry", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("webhook delivery is recorded after state change", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const webhookRes = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
      headers: authHeaders,
      data: {
        url: "https://httpbin.org/post",
        eventTypes: ["member.created"],
      },
    });
    expect(webhookRes.status()).toBe(HTTP_CREATED);
    const webhookId = (await parseJsonBody<{ data: { id: string } }>(webhookRes)).data.id;

    await request.post(`/v1/systems/${systemId}/members`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Webhook Test Member" }) },
    });

    // Poll for delivery instead of hard sleep
    await pollUntil(async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      if (res.status() !== HTTP_OK) return false;
      const body = await parseJsonBody<{ data: unknown[] }>(res);
      return body.data.length > 0;
    });

    const deliveriesRes = await request.get(
      `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
      { headers: authHeaders },
    );
    expect(deliveriesRes.status()).toBe(HTTP_OK);
    const body = await parseJsonBody<{ data: unknown[] }>(deliveriesRes);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
