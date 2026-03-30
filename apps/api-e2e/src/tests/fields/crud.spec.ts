import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createFieldDefinition, createMember, getSystemId } from "../../fixtures/entity-helpers.js";

const FIELD_DEF_DATA = {
  name: "Pronouns",
  placeholder: "e.g. they/them",
};

const UPDATED_FIELD_DEF_DATA = {
  name: "Pronouns (Updated)",
  placeholder: "e.g. she/her",
};

const FIELD_VALUE_DATA = { value: "they/them" };
const UPDATED_FIELD_VALUE_DATA = { value: "she/her" };

test.describe("Fields CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("field definition lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fieldsUrl = `/v1/systems/${systemId}/fields`;
    let fieldId: string;
    let fieldVersion: number;

    await test.step("create field definition", async () => {
      const res = await request.post(fieldsUrl, {
        headers: authHeaders,
        data: {
          fieldType: "text",
          encryptedData: encryptForApi(FIELD_DEF_DATA),
          sortOrder: 0,
          required: false,
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { data: { id: string; version: number } };
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("version");
      fieldId = body.data.id;
      fieldVersion = body.data.version;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${fieldsUrl}/${fieldId}`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { data: { id: string; encryptedData: string } };
      expect(body.data.id).toBe(fieldId);

      const decrypted = decryptFromApi(body.data.encryptedData);
      expect(decrypted).toEqual(FIELD_DEF_DATA);
    });

    await test.step("list includes created field", async () => {
      const res = await request.get(fieldsUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const ids = (body.data as { id: string }[]).map((f) => f.id);
      expect(ids).toContain(fieldId);
    });

    await test.step("update with new encrypted data", async () => {
      const res = await request.put(`${fieldsUrl}/${fieldId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_FIELD_DEF_DATA),
          version: fieldVersion,
        },
      });
      expect(res.status()).toBe(200);
      const updated = (await res.json()) as { data: { version: number } };
      fieldVersion = updated.data.version;

      const getRes = await request.get(`${fieldsUrl}/${fieldId}`, { headers: authHeaders });
      const fetched = (await getRes.json()) as { data: { encryptedData: string } };
      const decrypted = decryptFromApi(fetched.data.encryptedData);
      expect(decrypted).toEqual(UPDATED_FIELD_DEF_DATA);
    });

    await test.step("archive", async () => {
      const res = await request.post(`${fieldsUrl}/${fieldId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("restore", async () => {
      const res = await request.post(`${fieldsUrl}/${fieldId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const res = await request.delete(`${fieldsUrl}/${fieldId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("verify deleted returns 404", async () => {
      const res = await request.get(`${fieldsUrl}/${fieldId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("member field values: set, list, update, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fieldDef = await createFieldDefinition(request, authHeaders, systemId);
    const member = await createMember(request, authHeaders, systemId, "E2E Field Value Member");
    const valuesUrl = `/v1/systems/${systemId}/members/${member.id}/fields`;
    let valueVersion: number;

    await test.step("set field value", async () => {
      const res = await request.post(`${valuesUrl}/${fieldDef.id}`, {
        headers: authHeaders,
        data: { encryptedData: encryptForApi(FIELD_VALUE_DATA) },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { data: { version: number } };
      expect(body.data).toHaveProperty("version");
      valueVersion = body.data.version;
    });

    await test.step("list includes field value", async () => {
      const res = await request.get(valuesUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("items");
      const ids = (body.data.items as { fieldDefinitionId: string }[]).map(
        (v) => v.fieldDefinitionId,
      );
      expect(ids).toContain(fieldDef.id);
    });

    await test.step("update field value", async () => {
      const res = await request.put(`${valuesUrl}/${fieldDef.id}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_FIELD_VALUE_DATA),
          version: valueVersion,
        },
      });
      expect(res.status()).toBe(200);
    });

    await test.step("delete field value", async () => {
      const res = await request.delete(`${valuesUrl}/${fieldDef.id}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const fakeSystemId = "sys_00000000-0000-0000-0000-000000000000";

    const fieldsRes = await request.get(`/v1/systems/${fakeSystemId}/fields`, {
      headers: authHeaders,
    });
    expect(fieldsRes.status()).toBe(404);
  });
});
