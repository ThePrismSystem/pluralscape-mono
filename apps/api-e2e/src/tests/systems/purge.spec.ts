import {
  assertErrorShape,
  assertIdorRejected,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;

test.describe("System permanent purge", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("POST /v1/systems/:id/purge permanently deletes with password", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Create a second system so the original is not the last one (archiving the last system is forbidden)
    const createRes = await request.post("/v1/systems", {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Temp System" }) },
    });
    expect(createRes.status()).toBe(201);

    // Archive the original system
    const archiveRes = await request.delete(`/v1/systems/${systemId}`, { headers: authHeaders });
    expect(archiveRes.status()).toBe(HTTP_NO_CONTENT);

    const res = await request.post(`/v1/systems/${systemId}/purge`, {
      headers: authHeaders,
      data: { password: registeredAccount.password },
    });
    expect(res.status()).toBe(HTTP_NO_CONTENT);

    const getRes = await request.get(`/v1/systems/${systemId}`, { headers: authHeaders });
    expect(getRes.status()).toBe(404);
  });

  test("rejects wrong password", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Create a second system so the original can be archived
    const createRes = await request.post("/v1/systems", {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Temp System" }) },
    });
    expect(createRes.status()).toBe(201);

    // Archive the original system
    const archiveRes = await request.delete(`/v1/systems/${systemId}`, { headers: authHeaders });
    expect(archiveRes.status()).toBe(HTTP_NO_CONTENT);

    const res = await request.post(`/v1/systems/${systemId}/purge`, {
      headers: authHeaders,
      data: { password: "wrong-password" },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    await assertErrorShape(res);
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "POST", `/v1/systems/${systemId}/purge`);
  });

  test("rejects cross-account access", async ({
    request,
    authHeaders,
    secondAuthHeaders,
    secondRegisteredAccount,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(request, "POST", `/v1/systems/${systemId}/purge`, secondAuthHeaders, {
      password: secondRegisteredAccount.password,
    });
  });
});
