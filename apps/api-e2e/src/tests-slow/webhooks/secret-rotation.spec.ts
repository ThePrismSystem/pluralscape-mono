import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_OK, parseJsonBody } from "../../fixtures/http.constants.js";

test.describe("Webhook secret rotation", () => {
  test.describe.configure({ timeout: 120_000 });

  test("rotate-secret produces a new secret", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const createRes = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
      headers: authHeaders,
      data: {
        url: "https://httpbin.org/post",
        eventTypes: ["member.created"],
      },
    });
    expect(createRes.status()).toBe(HTTP_CREATED);
    const createBody = await parseJsonBody<{ data: { id: string } }>(createRes);
    const webhookId = createBody.data.id;

    const beforeRes = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
      headers: authHeaders,
    });
    expect(beforeRes.status()).toBe(HTTP_OK);
    const beforeBody = await parseJsonBody<{ data: { version: number } }>(beforeRes);

    const rotateRes = await request.post(
      `/v1/systems/${systemId}/webhook-configs/${webhookId}/rotate-secret`,
      {
        headers: authHeaders,
        data: { version: beforeBody.data.version },
      },
    );
    expect(rotateRes.ok()).toBe(true);

    const afterRes = await request.get(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
      headers: authHeaders,
    });
    expect(afterRes.status()).toBe(HTTP_OK);
    const afterBody = await parseJsonBody<{ data: { version: number } }>(afterRes);
    expect(afterBody.data.version).toBeGreaterThan(beforeBody.data.version);
  });
});
