import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";

const RELATIONSHIP_DATA = {
  description: "Twins",
  notes: "Very close",
};

const UPDATED_RELATIONSHIP_DATA = {
  description: "Twins (updated)",
  notes: "Very close",
};

test.describe("Relationships CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("relationship lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const relationshipsUrl = `/v1/systems/${systemId}/relationships`;

    const member1 = await createMember(request, authHeaders, systemId, "E2E Relationship Member A");
    const member2 = await createMember(request, authHeaders, systemId, "E2E Relationship Member B");

    let relationshipId: string;
    let relationshipVersion: number;

    await test.step("create with encrypted data", async () => {
      const encryptedData = encryptForApi(RELATIONSHIP_DATA);
      const createRes = await request.post(relationshipsUrl, {
        headers: authHeaders,
        data: {
          sourceMemberId: member1.id,
          targetMemberId: member2.id,
          type: "sibling",
          bidirectional: true,
          encryptedData,
        },
      });
      expect(createRes.status()).toBe(201);
      const relationship = await createRes.json();
      expect(relationship).toHaveProperty("id");
      relationshipId = relationship.id as string;
      relationshipVersion = relationship.version as number;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const getRes = await request.get(`${relationshipsUrl}/${relationshipId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.id).toBe(relationshipId);

      const decrypted = decryptFromApi(fetched.encryptedData as string);
      expect(decrypted).toEqual(RELATIONSHIP_DATA);
    });

    await test.step("list includes created relationship", async () => {
      const listRes = await request.get(relationshipsUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const listed = await listRes.json();
      expect(listed).toHaveProperty("data");
      expect(listed).toHaveProperty("nextCursor");
      expect(listed).toHaveProperty("hasMore");
      expect(listed.data.length).toBeGreaterThanOrEqual(1);

      const found = (listed.data as Array<{ id: string }>).find(
        (item) => item.id === relationshipId,
      );
      expect(found).toBeTruthy();
    });

    await test.step("update with new encrypted data", async () => {
      const updatedEncryptedData = encryptForApi(UPDATED_RELATIONSHIP_DATA);
      const updateRes = await request.put(`${relationshipsUrl}/${relationshipId}`, {
        headers: authHeaders,
        data: {
          type: "sibling",
          bidirectional: true,
          encryptedData: updatedEncryptedData,
          version: relationshipVersion,
        },
      });
      expect(updateRes.status()).toBe(200);

      const updatedGet = await request.get(`${relationshipsUrl}/${relationshipId}`, {
        headers: authHeaders,
      });
      const updatedRelationship = await updatedGet.json();
      const decryptedUpdate = decryptFromApi(updatedRelationship.encryptedData as string);
      expect(decryptedUpdate).toEqual(UPDATED_RELATIONSHIP_DATA);
    });

    await test.step("archive", async () => {
      const archiveRes = await request.post(`${relationshipsUrl}/${relationshipId}/archive`, {
        headers: authHeaders,
      });
      expect(archiveRes.status()).toBe(204);
    });

    await test.step("restore", async () => {
      const restoreRes = await request.post(`${relationshipsUrl}/${relationshipId}/restore`, {
        headers: authHeaders,
      });
      expect(restoreRes.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const deleteRes = await request.delete(`${relationshipsUrl}/${relationshipId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(204);
    });

    await test.step("verify deleted returns 404", async () => {
      const deletedGet = await request.get(`${relationshipsUrl}/${relationshipId}`, {
        headers: authHeaders,
      });
      expect(deletedGet.status()).toBe(404);
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(
      "/v1/systems/sys_00000000-0000-0000-0000-000000000000/relationships",
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
