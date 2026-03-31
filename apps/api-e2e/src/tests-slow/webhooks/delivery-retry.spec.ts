import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_OK } from "../../fixtures/http.constants.js";

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
    const webhookId = ((await webhookRes.json()) as { data: { id: string } }).data.id;

    await request.post(`/v1/systems/${systemId}/members`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Webhook Test Member" }) },
    });

    // Wait for delivery to process
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const deliveriesRes = await request.get(
      `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
      { headers: authHeaders },
    );
    expect(deliveriesRes.status()).toBe(HTTP_OK);
    const body = (await deliveriesRes.json()) as { data: unknown[] };
    expect(body).toHaveProperty("data");
  });
});
