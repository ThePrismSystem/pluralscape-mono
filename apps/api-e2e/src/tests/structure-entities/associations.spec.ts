import { assertIdorRejected, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createStructureEntity,
  createStructureEntityType,
  getSystemId,
} from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

test.describe("Structure entity associations", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("association lifecycle: create, list, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);
    const entityA = await createStructureEntity(request, authHeaders, systemId, entityType.id, {
      name: "Entity A",
    });
    const entityB = await createStructureEntity(request, authHeaders, systemId, entityType.id, {
      name: "Entity B",
    });

    const assocUrl = `/v1/systems/${systemId}/structure/entity-associations`;
    let assocId: string;

    await test.step("create association", async () => {
      const res = await request.post(assocUrl, {
        headers: authHeaders,
        data: { sourceEntityId: entityA.id, targetEntityId: entityB.id },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      assocId = body.data.id;
    });

    await test.step("list includes association", async () => {
      const res = await request.get(assocUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((a) => a.id)).toContain(assocId);
    });

    await test.step("delete association", async () => {
      const res = await request.delete(`${assocUrl}/${assocId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-associations`,
    );
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-associations`,
      secondAuthHeaders,
    );
  });
});
