import {
  assertPwhashSalt,
  deriveAuthAndPasswordKeys,
  fromHex,
  initSodium,
  toHex,
} from "@pluralscape/crypto";

import {
  assertErrorShape,
  assertIdorRejected,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT } from "../../fixtures/http.constants.js";

import type { APIRequestContext } from "@playwright/test";

/**
 * Derive authKey from email + password via the salt endpoint.
 */
async function deriveAuthKeyHex(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  await initSodium();
  const saltRes = await request.post("/v1/auth/salt", { data: { email } });
  const saltBody = (await saltRes.json()) as { data: { kdfSalt: string } };
  const saltBytes = fromHex(saltBody.data.kdfSalt);
  assertPwhashSalt(saltBytes);
  const passwordBytes = new TextEncoder().encode(password);
  const { authKey } = await deriveAuthAndPasswordKeys(passwordBytes, saltBytes);
  return toHex(authKey);
}

test.describe("System permanent purge", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("POST /v1/systems/:id/purge permanently deletes with authKey", async ({
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

    const authKeyHex = await deriveAuthKeyHex(
      request,
      registeredAccount.email,
      registeredAccount.password,
    );
    const res = await request.post(`/v1/systems/${systemId}/purge`, {
      headers: authHeaders,
      data: { authKey: authKeyHex },
    });
    expect(res.status()).toBe(HTTP_NO_CONTENT);

    const getRes = await request.get(`/v1/systems/${systemId}`, { headers: authHeaders });
    expect(getRes.status()).toBe(404);
  });

  test("rejects wrong authKey", async ({ request, authHeaders }) => {
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
      data: { authKey: "0".repeat(64) },
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
    const authKeyHex = await deriveAuthKeyHex(
      request,
      secondRegisteredAccount.email,
      secondRegisteredAccount.password,
    );
    await assertIdorRejected(request, "POST", `/v1/systems/${systemId}/purge`, secondAuthHeaders, {
      authKey: authKeyHex,
    });
  });
});
