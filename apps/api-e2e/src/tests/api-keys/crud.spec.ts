import {
  assertErrorShape,
  assertIdorRejected,
  assertPaginates,
  assertRequiresAuth,
  assertValidationRejects,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createApiKey, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

test.describe("API keys CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("metadata key lifecycle: create, get, list, revoke", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const keysUrl = `/v1/systems/${systemId}/api-keys`;
    let keyId: string;

    await test.step("create metadata API key", async () => {
      const res = await request.post(keysUrl, {
        headers: authHeaders,
        data: {
          keyType: "metadata",
          scopes: ["read:members"],
          encryptedData: encryptForApi({ label: "Test Metadata Key" }),
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      keyId = body.data.id;
      expect(keyId).toBeTruthy();
    });

    await test.step("get API key by ID", async () => {
      const res = await request.get(`${keysUrl}/${keyId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { id: string; keyType: string } };
      expect(body.data.id).toBe(keyId);
      expect(body.data.keyType).toBe("metadata");
    });

    await test.step("list includes the key", async () => {
      const res = await request.get(keysUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      const ids = body.data.map((k) => k.id);
      expect(ids).toContain(keyId);
    });

    await test.step("revoke API key", async () => {
      const res = await request.post(`${keysUrl}/${keyId}/revoke`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("revoke is idempotent", async () => {
      const res = await request.post(`${keysUrl}/${keyId}/revoke`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("crypto key requires encryptedKeyMaterial", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const keysUrl = `/v1/systems/${systemId}/api-keys`;

    await test.step("create crypto key with material succeeds", async () => {
      const res = await request.post(keysUrl, {
        headers: authHeaders,
        data: {
          keyType: "crypto",
          scopes: ["read:members", "write:members"],
          encryptedData: encryptForApi({ label: "Test Crypto Key" }),
          encryptedKeyMaterial: "dGVzdC1lbmNyeXB0ZWQta2V5LW1hdGVyaWFs",
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

    await test.step("create crypto key without material fails", async () => {
      const res = await request.post(keysUrl, {
        headers: authHeaders,
        data: {
          keyType: "crypto",
          scopes: ["read:members"],
          encryptedData: encryptForApi({ label: "Missing Material" }),
        },
      });
      expect(res.ok()).toBe(false);
      await assertErrorShape(res);
    });
  });

  test("validation rejects bad input", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertValidationRejects(
      request,
      "POST",
      `/v1/systems/${systemId}/api-keys`,
      authHeaders,
      [
        {},
        { keyType: "invalid", scopes: ["read:members"], encryptedData: "x" },
        { keyType: "metadata", scopes: [], encryptedData: "x" },
      ],
    );
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/api-keys`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(request, "GET", `/v1/systems/${systemId}/api-keys`, secondAuthHeaders);
  });

  test("list paginates", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertPaginates(request, `/v1/systems/${systemId}/api-keys`, authHeaders, async () => {
      await createApiKey(request, authHeaders, systemId);
    });
  });
});
