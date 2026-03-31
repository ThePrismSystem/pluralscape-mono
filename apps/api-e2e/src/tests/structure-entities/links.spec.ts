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

test.describe("Structure entity links", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("link lifecycle: create, list, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);
    const entity = await createStructureEntity(request, authHeaders, systemId, entityType.id);
    const linksUrl = `/v1/systems/${systemId}/structure/entity-links`;
    let linkId: string;

    await test.step("create link", async () => {
      const res = await request.post(linksUrl, {
        headers: authHeaders,
        data: { entityId: entity.id, parentEntityId: null, sortOrder: 0 },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      linkId = body.data.id;
    });

    await test.step("list includes link", async () => {
      const res = await request.get(linksUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((l) => l.id)).toContain(linkId);
    });

    await test.step("delete link", async () => {
      const res = await request.delete(`${linksUrl}/${linkId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/structure/entity-links`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-links`,
      secondAuthHeaders,
    );
  });
});
