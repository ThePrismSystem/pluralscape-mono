import { assertIdorRejected, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

test.describe("Member photos", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("photo lifecycle: create, get single, list, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const member = await createMember(request, authHeaders, systemId);
    const photosUrl = `/v1/systems/${systemId}/members/${member.id}/photos`;
    let photoId: string;

    await test.step("create photo", async () => {
      const res = await request.post(photosUrl, {
        headers: authHeaders,
        data: { encryptedData: encryptForApi({ caption: "Test photo" }), sortOrder: 0 },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      photoId = body.data.id;
    });

    await test.step("get single photo by ID", async () => {
      const res = await request.get(`${photosUrl}/${photoId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { id: string } };
      expect(body.data.id).toBe(photoId);
    });

    await test.step("list photos", async () => {
      const res = await request.get(photosUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((p) => p.id)).toContain(photoId);
    });

    await test.step("archive photo", async () => {
      const res = await request.post(`${photosUrl}/${photoId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("restore photo", async () => {
      const res = await request.post(`${photosUrl}/${photoId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete photo", async () => {
      const res = await request.delete(`${photosUrl}/${photoId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const member = await createMember(request, authHeaders, systemId);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/members/${member.id}/photos`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const member = await createMember(request, authHeaders, systemId);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/members/${member.id}/photos`,
      secondAuthHeaders,
    );
  });
});
