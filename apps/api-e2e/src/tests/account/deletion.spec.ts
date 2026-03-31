import { assertErrorShape, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;

test.describe("Account deletion", () => {
  test("DELETE /v1/account deletes account with password confirmation", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const before = await request.get("/v1/account", { headers: authHeaders });
    expect(before.ok()).toBe(true);

    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: { password: registeredAccount.password },
    });
    expect(res.status()).toBe(HTTP_NO_CONTENT);

    const after = await request.get("/v1/account", { headers: authHeaders });
    expect(after.status()).toBe(HTTP_UNAUTHORIZED);
  });

  test("DELETE /v1/account rejects wrong password", async ({ request, authHeaders }) => {
    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: { password: "wrong-password-here" },
    });
    expect(res.status()).toBe(HTTP_UNAUTHORIZED);
    await assertErrorShape(res);
  });

  test("DELETE /v1/account rejects missing password", async ({ request, authHeaders }) => {
    const res = await request.delete("/v1/account", {
      headers: authHeaders,
      data: {},
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    await assertErrorShape(res);
  });

  test("DELETE /v1/account requires auth", async ({ request }) => {
    await assertRequiresAuth(request, "DELETE", "/v1/account");
  });

  test("DELETE /v1/account cascades to systems", async ({
    request,
    registeredAccount,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    expect(systemId).toBeTruthy();

    const del = await request.delete("/v1/account", {
      headers: authHeaders,
      data: { password: registeredAccount.password },
    });
    expect(del.status()).toBe(HTTP_NO_CONTENT);

    const login = await request.post("/v1/auth/login", {
      data: { email: registeredAccount.email, password: registeredAccount.password },
    });
    expect(login.status()).toBe(HTTP_UNAUTHORIZED);
  });
});
