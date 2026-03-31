import {
  assertErrorShape,
  assertIdorRejected,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;

test.describe("System permanent purge", () => {
  test("POST /v1/systems/:id/purge permanently deletes with password", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);

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

    const res = await request.post(`/v1/systems/${systemId}/purge`, {
      headers: authHeaders,
      data: { password: "wrong-password" },
    });
    expect(res.status()).toBe(HTTP_UNAUTHORIZED);
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
