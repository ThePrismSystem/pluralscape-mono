import { assertIdorRejected, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createMember,
  createStructureEntity,
  createStructureEntityType,
  getSystemId,
} from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK } from "../../fixtures/http.constants.js";

test.describe("Structure entity member links", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("member link lifecycle: create, list, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);
    const entity = await createStructureEntity(request, authHeaders, systemId, entityType.id);
    const member = await createMember(request, authHeaders, systemId);
    const memberLinksUrl = `/v1/systems/${systemId}/structure/entity-member-links`;
    let linkId: string;

    await test.step("create member link", async () => {
      const res = await request.post(memberLinksUrl, {
        headers: authHeaders,
        data: { parentEntityId: entity.id, memberId: member.id, sortOrder: 0 },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      linkId = body.data.id;
    });

    await test.step("list includes member link", async () => {
      const res = await request.get(memberLinksUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((l) => l.id)).toContain(linkId);
    });

    await test.step("delete member link", async () => {
      const res = await request.delete(`${memberLinksUrl}/${linkId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-member-links`,
    );
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/structure/entity-member-links`,
      secondAuthHeaders,
    );
  });
});
