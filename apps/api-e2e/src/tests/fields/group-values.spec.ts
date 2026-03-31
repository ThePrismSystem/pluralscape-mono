import { assertIdorRejected, assertRequiresAuth } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createFieldDefinition, createGroup, getSystemId } from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

test.describe("Group custom field values", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("field value lifecycle: set, list, update, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const group = await createGroup(request, authHeaders, systemId);
    const field = await createFieldDefinition(request, authHeaders, systemId);
    const fieldsUrl = `/v1/systems/${systemId}/groups/${group.id}/fields`;

    await test.step("set field value", async () => {
      const res = await request.post(`${fieldsUrl}/${field.id}`, {
        headers: authHeaders,
        data: { encryptedData: encryptForApi({ value: "test value" }) },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

    await test.step("list field values", async () => {
      const res = await request.get(fieldsUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ fieldDefinitionId: string }> };
      expect(body.data.map((f) => f.fieldDefinitionId)).toContain(field.id);
    });

    await test.step("update field value", async () => {
      const res = await request.put(`${fieldsUrl}/${field.id}`, {
        headers: authHeaders,
        data: { encryptedData: encryptForApi({ value: "updated value" }) },
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete field value", async () => {
      const res = await request.delete(`${fieldsUrl}/${field.id}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const group = await createGroup(request, authHeaders, systemId);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/groups/${group.id}/fields`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const group = await createGroup(request, authHeaders, systemId);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/groups/${group.id}/fields`,
      secondAuthHeaders,
    );
  });
});
