import { assertIdorRejected } from "../../fixtures/assertions.js";
import { test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { SYSTEM_SCOPED_ENDPOINTS } from "../../fixtures/endpoint-registry.js";

test.describe("Systematic IDOR rejection", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  for (const ep of SYSTEM_SCOPED_ENDPOINTS) {
    test(`${ep.label} rejects cross-account access`, async ({
      request,
      authHeaders,
      secondAuthHeaders,
    }) => {
      const { url, body } = await ep.resolve(request, authHeaders);
      await assertIdorRejected(request, ep.method, url, secondAuthHeaders, body);
    });
  }
});
