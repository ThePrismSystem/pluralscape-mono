import { assertRejectsGarbageToken, assertRequiresAuth } from "../../fixtures/assertions.js";
import { test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { PROTECTED_ENDPOINTS } from "../../fixtures/endpoint-registry.js";

test.describe("Systematic auth rejection", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  for (const ep of PROTECTED_ENDPOINTS) {
    test(`${ep.label} rejects unauthenticated request`, async ({ request, authHeaders }) => {
      const { url, body } = await ep.resolve(request, authHeaders);
      await assertRequiresAuth(request, ep.method, url, body);
    });

    test(`${ep.label} rejects garbage token`, async ({ request, authHeaders }) => {
      const { url, body } = await ep.resolve(request, authHeaders);
      await assertRejectsGarbageToken(request, ep.method, url, body);
    });
  }
});
