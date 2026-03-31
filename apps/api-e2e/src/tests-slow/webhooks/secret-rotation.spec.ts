import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_CREATED = 201;
const HTTP_OK = 200;

test.describe("Webhook secret rotation", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("rotate-secret produces a new secret", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const createRes = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ label: "E2E rotation test" }),
        url: "https://httpbin.org/post",
        events: ["member.created"],
      },
    });
    expect(createRes.status()).toBe(HTTP_CREATED);
    const webhookId = ((await createRes.json()) as { data: { id: string } }).data.id;

    const beforeRes = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
      headers: authHeaders,
    });
    expect(beforeRes.status()).toBe(HTTP_OK);

    const rotateRes = await request.post(
      `/v1/systems/${systemId}/webhook-configs/${webhookId}/rotate-secret`,
      { headers: authHeaders },
    );
    expect(rotateRes.ok()).toBe(true);

    const afterRes = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
      headers: authHeaders,
    });
    expect(afterRes.status()).toBe(HTTP_OK);
  });
});
