import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

const CUSTOM_FRONT_DATA = {
  label: "Dissociated",
  color: "#ff0000",
};

const UPDATED_CUSTOM_FRONT_DATA = {
  label: "Dissociated (Updated)",
  color: "#00ff00",
};

test.describe("Custom Fronts CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("custom front lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const customFrontsUrl = `/v1/systems/${systemId}/custom-fronts`;
    let customFrontId: string;
    let customFrontVersion: number;

    await test.step("create with encrypted data", async () => {
      const encryptedData = encryptForApi(CUSTOM_FRONT_DATA);
      const createRes = await request.post(customFrontsUrl, {
        headers: authHeaders,
        data: { encryptedData },
      });
      expect(createRes.status()).toBe(201);
      const body = await createRes.json();
      expect(body).toHaveProperty("id");
      customFrontId = body.id as string;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const getRes = await request.get(`${customFrontsUrl}/${customFrontId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(200);
      const body = await getRes.json();
      expect(body.id).toBe(customFrontId);

      const decrypted = decryptFromApi(body.encryptedData as string);
      expect(decrypted).toEqual(CUSTOM_FRONT_DATA);
      customFrontVersion = body.version as number;
    });

    await test.step("list includes created custom front", async () => {
      const listRes = await request.get(customFrontsUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("hasMore");
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    await test.step("update with new encrypted data", async () => {
      const updatedEncryptedData = encryptForApi(UPDATED_CUSTOM_FRONT_DATA);
      const updateRes = await request.put(`${customFrontsUrl}/${customFrontId}`, {
        headers: authHeaders,
        data: {
          encryptedData: updatedEncryptedData,
          version: customFrontVersion,
        },
      });
      expect(updateRes.status()).toBe(200);

      const updatedGet = await request.get(`${customFrontsUrl}/${customFrontId}`, {
        headers: authHeaders,
      });
      const updatedBody = await updatedGet.json();
      const decryptedUpdate = decryptFromApi(updatedBody.encryptedData as string);
      expect(decryptedUpdate).toEqual(UPDATED_CUSTOM_FRONT_DATA);
    });

    await test.step("archive", async () => {
      const archiveRes = await request.post(`${customFrontsUrl}/${customFrontId}/archive`, {
        headers: authHeaders,
      });
      expect(archiveRes.status()).toBe(204);
    });

    await test.step("restore", async () => {
      const restoreRes = await request.post(`${customFrontsUrl}/${customFrontId}/restore`, {
        headers: authHeaders,
      });
      expect(restoreRes.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const deleteRes = await request.delete(`${customFrontsUrl}/${customFrontId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(204);
    });

    await test.step("verify deleted returns 404", async () => {
      const deletedGet = await request.get(`${customFrontsUrl}/${customFrontId}`, {
        headers: authHeaders,
      });
      expect(deletedGet.status()).toBe(404);
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(
      "/v1/systems/sys_00000000-0000-0000-0000-000000000000/custom-fronts",
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
