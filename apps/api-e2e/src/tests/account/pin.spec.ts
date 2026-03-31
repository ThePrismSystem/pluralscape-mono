import {
  assertErrorShape,
  assertRequiresAuth,
  assertIdorRejected,
  assertValidationRejects,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { ensureSystemSetup, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;

test.describe("System PIN management", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("PIN lifecycle: set, verify, remove", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await ensureSystemSetup(request, authHeaders, systemId);
    const pinUrl = `/v1/systems/${systemId}/settings/pin`;

    await test.step("set PIN", async () => {
      const res = await request.post(pinUrl, {
        headers: authHeaders,
        data: { pin: "1234" },
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("verify correct PIN", async () => {
      const res = await request.post(`${pinUrl}/verify`, {
        headers: authHeaders,
        data: { pin: "1234" },
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("verify wrong PIN rejected", async () => {
      const res = await request.post(`${pinUrl}/verify`, {
        headers: authHeaders,
        data: { pin: "9999" },
      });
      expect(res.ok()).toBe(false);
      await assertErrorShape(res);
    });

    await test.step("remove PIN", async () => {
      const res = await request.delete(pinUrl, {
        headers: authHeaders,
        data: { pin: "1234" },
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("verify after removal fails", async () => {
      const res = await request.post(`${pinUrl}/verify`, {
        headers: authHeaders,
        data: { pin: "1234" },
      });
      expect(res.ok()).toBe(false);
      await assertErrorShape(res);
    });
  });

  test("PIN rejects invalid format", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertValidationRejects(
      request,
      "POST",
      `/v1/systems/${systemId}/settings/pin`,
      authHeaders,
      [{ pin: "abc" }, { pin: "12" }, { pin: "12345678" }, {}],
    );
  });

  test("PIN requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "POST", `/v1/systems/${systemId}/settings/pin`);
  });

  test("PIN rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "POST",
      `/v1/systems/${systemId}/settings/pin`,
      secondAuthHeaders,
      { pin: "1234" },
    );
  });
});
