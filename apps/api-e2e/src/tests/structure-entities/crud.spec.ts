import {
  assertIdorRejected,
  assertPaginates,
  assertRequiresAuth,
  assertValidationRejects,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createStructureEntity,
  createStructureEntityType,
  getSystemId,
} from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK } from "../../fixtures/http.constants.js";

test.describe("Structure entity CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("entity lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entitiesUrl = `/v1/systems/${systemId}/structure/entities`;
    let entityId: string;
    let entityVersion: number;

    const entityType = await createStructureEntityType(request, authHeaders, systemId);

    await test.step("create entity", async () => {
      const res = await request.post(entitiesUrl, {
        headers: authHeaders,
        data: {
          structureEntityTypeId: entityType.id,
          encryptedData: encryptForApi({ name: "Test Entity" }),
          parentEntityId: null,
          sortOrder: 0,
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string; version: number } };
      entityId = body.data.id;
      entityVersion = body.data.version;
    });

    await test.step("get entity", async () => {
      const res = await request.get(`${entitiesUrl}/${entityId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { id: string } };
      expect(body.data.id).toBe(entityId);
    });

    await test.step("list includes entity", async () => {
      const res = await request.get(entitiesUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((e) => e.id)).toContain(entityId);
    });

    await test.step("update entity", async () => {
      const res = await request.put(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Updated Entity" }),
          parentEntityId: null,
          sortOrder: 1,
          version: entityVersion,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { version: number } };
      entityVersion = body.data.version;
    });

    await test.step("archive entity", async () => {
      const res = await request.post(`${entitiesUrl}/${entityId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("restore entity", async () => {
      const res = await request.post(`${entitiesUrl}/${entityId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete entity", async () => {
      const res = await request.delete(`${entitiesUrl}/${entityId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("get deleted entity returns 404", async () => {
      const res = await request.get(`${entitiesUrl}/${entityId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("hierarchy: parent-child relationship", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);

    const parent = await createStructureEntity(request, authHeaders, systemId, entityType.id, {
      name: "Parent",
    });
    const child = await createStructureEntity(request, authHeaders, systemId, entityType.id, {
      name: "Child",
      parentEntityId: parent.id,
    });

    // Hierarchy returns ancestor chain for the requested entity
    const res = await request.get(
      `/v1/systems/${systemId}/structure/entities/${child.id}/hierarchy`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as {
      data: Array<{ entityId: string; parentEntityId: string | null; depth: number }>;
    };
    const entityIds = body.data.map((node) => node.entityId);
    expect(entityIds).toContain(child.id);
    const childNode = body.data.find((node) => node.entityId === child.id);
    expect(childNode?.parentEntityId).toBe(parent.id);
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/structure/entities`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entities`,
      secondAuthHeaders,
    );
  });

  test("list paginates", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);
    await assertPaginates(
      request,
      `/v1/systems/${systemId}/structure/entities`,
      authHeaders,
      async () => {
        await createStructureEntity(request, authHeaders, systemId, entityType.id);
      },
    );
  });

  test("validation rejects bad input", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertValidationRejects(
      request,
      "POST",
      `/v1/systems/${systemId}/structure/entities`,
      authHeaders,
      [
        {},
        { encryptedData: "x" },
        { structureEntityTypeId: "nonexistent", encryptedData: "x", sortOrder: 0 },
      ],
    );
  });
});
