import {
  assertIdorRejected,
  assertPaginates,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createStructureEntityType, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_CONFLICT = 409;

test.describe("Structure entity types CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("entity type lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const typesUrl = `/v1/systems/${systemId}/structure/entity-types`;
    let typeId: string;
    let typeVersion: number;

    await test.step("create entity type", async () => {
      const res = await request.post(typesUrl, {
        headers: authHeaders,
        data: { encryptedData: encryptForApi({ name: "Location" }), sortOrder: 0 },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string; version: number } };
      typeId = body.data.id;
      typeVersion = body.data.version;
    });

    await test.step("get entity type", async () => {
      const res = await request.get(`${typesUrl}/${typeId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("list includes type", async () => {
      const res = await request.get(typesUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((t) => t.id)).toContain(typeId);
    });

    await test.step("update entity type", async () => {
      const res = await request.put(`${typesUrl}/${typeId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Region" }),
          sortOrder: 1,
          version: typeVersion,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { version: number } };
      typeVersion = body.data.version;
    });

    await test.step("archive entity type", async () => {
      const res = await request.post(`${typesUrl}/${typeId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("restore entity type", async () => {
      const res = await request.post(`${typesUrl}/${typeId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete entity type", async () => {
      const res = await request.delete(`${typesUrl}/${typeId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("delete rejects when entities exist (HAS_DEPENDENTS)", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);

    await request.post(`/v1/systems/${systemId}/structure/entities`, {
      headers: authHeaders,
      data: {
        structureEntityTypeId: entityType.id,
        encryptedData: encryptForApi({ name: "Blocking Entity" }),
        parentEntityId: null,
        sortOrder: 0,
      },
    });

    const res = await request.delete(
      `/v1/systems/${systemId}/structure/entity-types/${entityType.id}`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(HTTP_CONFLICT);
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/structure/entity-types`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-types`,
      secondAuthHeaders,
    );
  });

  test("list paginates", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertPaginates(
      request,
      `/v1/systems/${systemId}/structure/entity-types`,
      authHeaders,
      async () => {
        await createStructureEntityType(request, authHeaders, systemId);
      },
    );
  });
});
