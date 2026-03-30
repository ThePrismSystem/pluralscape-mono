import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Idempotency Keys", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("POST with idempotency key returns same response on retry", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const idempotencyKey = crypto.randomUUID();
    const encryptedData = encryptForApi({ name: "Idempotency Test" });

    const first = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": idempotencyKey },
      data: { encryptedData },
    });
    expect(first.status()).toBe(201);
    const firstBody = (await first.json()) as { data: { id: string } };

    const second = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": idempotencyKey },
      data: { encryptedData },
    });
    expect(second.status()).toBe(201);
    const secondBody = (await second.json()) as { data: { id: string } };

    // Same response replayed — same member ID
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });

  test("POST without idempotency key creates new resource each time", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const encryptedData = encryptForApi({ name: "No-Idem Test" });

    const first = await request.post(membersUrl, {
      headers: authHeaders,
      data: { encryptedData },
    });
    const second = await request.post(membersUrl, {
      headers: authHeaders,
      data: { encryptedData },
    });

    const firstBody = (await first.json()) as { data: { id: string } };
    const secondBody = (await second.json()) as { data: { id: string } };
    expect(firstBody.data.id).not.toBe(secondBody.data.id);
  });

  test("rejects overly long idempotency key", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const encryptedData = encryptForApi({ name: "Long Key Test" });

    const res = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": "x".repeat(100) },
      data: { encryptedData },
    });
    expect(res.status()).toBe(400);
  });
});
