import { assertIdorRejected, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createSnapshot, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_CREATED = 201;

test.describe("System duplication", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("POST /v1/systems/:id/duplicate creates a copy", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const snapshot = await createSnapshot(request, authHeaders, systemId);

    const res = await request.post(`/v1/systems/${systemId}/duplicate`, {
      headers: authHeaders,
      data: { snapshotId: snapshot.id },
    });
    expect(res.status()).toBe(HTTP_CREATED);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBeTruthy();
    expect(body.data.id).not.toBe(systemId);

    const getRes = await request.get(`/v1/systems/${body.data.id}`, { headers: authHeaders });
    expect(getRes.ok()).toBe(true);
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "POST", `/v1/systems/${systemId}/duplicate`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "POST",
      `/v1/systems/${systemId}/duplicate`,
      secondAuthHeaders,
      { snapshotId: "snap_00000000-0000-0000-0000-000000000001" },
    );
  });
});
