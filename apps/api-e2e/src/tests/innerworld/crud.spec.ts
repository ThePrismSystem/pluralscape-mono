import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createInnerworldRegion, getSystemId } from "../../fixtures/entity-helpers.js";

const ENTITY_DATA = {
  name: "Safe Room",
  description: "A cozy space",
};

const UPDATED_ENTITY_DATA = {
  name: "Safe Room (Updated)",
  description: "A cozy space, renovated",
};

const REGION_DATA = {
  name: "Meadow",
  description: "Open field",
};

const UPDATED_REGION_DATA = {
  name: "Meadow (Updated)",
  description: "Open field with wildflowers",
};

test.describe("Innerworld CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("entity lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entitiesUrl = `/v1/systems/${systemId}/innerworld/entities`;
    let entityId: string;
    let entityVersion: number;

    await test.step("create with encrypted data", async () => {
      const encryptedData = encryptForApi(ENTITY_DATA);
      const createRes = await request.post(entitiesUrl, {
        headers: authHeaders,
        data: { encryptedData, regionId: null },
      });
      expect(createRes.status()).toBe(201);
      const body = await createRes.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("version");
      entityId = body.id as string;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const getRes = await request.get(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(200);
      const body = await getRes.json();
      expect(body.id).toBe(entityId);

      const decrypted = decryptFromApi(body.encryptedData as string);
      expect(decrypted).toEqual(ENTITY_DATA);
      entityVersion = body.version as number;
    });

    await test.step("list includes created entity", async () => {
      const listRes = await request.get(entitiesUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      expect(body).toHaveProperty("items");
      expect(body.items.length).toBeGreaterThanOrEqual(1);

      const found = (body.items as Array<{ id: string }>).some((e) => e.id === entityId);
      expect(found).toBe(true);
    });

    await test.step("update with new encrypted data", async () => {
      const updatedEncryptedData = encryptForApi(UPDATED_ENTITY_DATA);
      const updateRes = await request.put(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
        data: {
          encryptedData: updatedEncryptedData,
          version: entityVersion,
        },
      });
      expect(updateRes.status()).toBe(200);

      const updatedGet = await request.get(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
      });
      const updatedBody = await updatedGet.json();
      const decryptedUpdate = decryptFromApi(updatedBody.encryptedData as string);
      expect(decryptedUpdate).toEqual(UPDATED_ENTITY_DATA);
    });

    await test.step("archive", async () => {
      const archiveRes = await request.post(`${entitiesUrl}/${entityId}/archive`, {
        headers: authHeaders,
      });
      expect(archiveRes.status()).toBe(200);
    });

    await test.step("restore", async () => {
      const restoreRes = await request.post(`${entitiesUrl}/${entityId}/restore`, {
        headers: authHeaders,
      });
      expect(restoreRes.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const deleteRes = await request.delete(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(200);
    });

    await test.step("verify deleted returns 404", async () => {
      const deletedGet = await request.get(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
      });
      expect(deletedGet.status()).toBe(404);
    });
  });

  test("region lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const regionsUrl = `/v1/systems/${systemId}/innerworld/regions`;
    let regionId: string;
    let regionVersion: number;

    await test.step("create with encrypted data", async () => {
      const encryptedData = encryptForApi(REGION_DATA);
      const createRes = await request.post(regionsUrl, {
        headers: authHeaders,
        data: { encryptedData, parentRegionId: null },
      });
      expect(createRes.status()).toBe(201);
      const body = await createRes.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("version");
      regionId = body.id as string;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const getRes = await request.get(`${regionsUrl}/${regionId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(200);
      const body = await getRes.json();
      expect(body.id).toBe(regionId);

      const decrypted = decryptFromApi(body.encryptedData as string);
      expect(decrypted).toEqual(REGION_DATA);
      regionVersion = body.version as number;
    });

    await test.step("list includes created region", async () => {
      const listRes = await request.get(regionsUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      expect(body).toHaveProperty("items");
      expect(body.items.length).toBeGreaterThanOrEqual(1);

      const found = (body.items as Array<{ id: string }>).some((r) => r.id === regionId);
      expect(found).toBe(true);
    });

    await test.step("update with new encrypted data", async () => {
      const updatedEncryptedData = encryptForApi(UPDATED_REGION_DATA);
      const updateRes = await request.put(`${regionsUrl}/${regionId}`, {
        headers: authHeaders,
        data: {
          encryptedData: updatedEncryptedData,
          version: regionVersion,
        },
      });
      expect(updateRes.status()).toBe(200);

      const updatedGet = await request.get(`${regionsUrl}/${regionId}`, {
        headers: authHeaders,
      });
      const updatedBody = await updatedGet.json();
      const decryptedUpdate = decryptFromApi(updatedBody.encryptedData as string);
      expect(decryptedUpdate).toEqual(UPDATED_REGION_DATA);
    });

    await test.step("archive", async () => {
      const archiveRes = await request.post(`${regionsUrl}/${regionId}/archive`, {
        headers: authHeaders,
      });
      expect(archiveRes.status()).toBe(200);
    });

    await test.step("restore", async () => {
      const restoreRes = await request.post(`${regionsUrl}/${regionId}/restore`, {
        headers: authHeaders,
      });
      expect(restoreRes.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const deleteRes = await request.delete(`${regionsUrl}/${regionId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(200);
    });

    await test.step("verify deleted returns 404", async () => {
      const deletedGet = await request.get(`${regionsUrl}/${regionId}`, {
        headers: authHeaders,
      });
      expect(deletedGet.status()).toBe(404);
    });
  });

  test("entity with region reference", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entitiesUrl = `/v1/systems/${systemId}/innerworld/entities`;

    const region = await createInnerworldRegion(request, authHeaders, systemId);

    const encryptedData = encryptForApi(ENTITY_DATA);
    const createRes = await request.post(entitiesUrl, {
      headers: authHeaders,
      data: { encryptedData, regionId: region.id },
    });
    expect(createRes.status()).toBe(201);
    const entity = await createRes.json();
    const entityId = entity.id as string;

    const getRes = await request.get(`${entitiesUrl}/${entityId}`, {
      headers: authHeaders,
    });
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.regionId).toBe(region.id);

    // Cleanup
    await request.delete(`${entitiesUrl}/${entityId}`, { headers: authHeaders });
    await request.delete(`/v1/systems/${systemId}/innerworld/regions/${region.id}`, {
      headers: authHeaders,
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const fakeSystemId = "sys_00000000-0000-0000-0000-000000000000";

    const entitiesRes = await request.get(`/v1/systems/${fakeSystemId}/innerworld/entities`, {
      headers: authHeaders,
    });
    expect(entitiesRes.status()).toBe(404);

    const regionsRes = await request.get(`/v1/systems/${fakeSystemId}/innerworld/regions`, {
      headers: authHeaders,
    });
    expect(regionsRes.status()).toBe(404);
  });
});
