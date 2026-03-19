import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";

import type { APIRequestContext } from "@playwright/test";

async function getSystemId(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<string> {
  const res = await request.get("/v1/systems", { headers });
  const body = await res.json();
  return body.items[0].id as string;
}

const MEMBER_PROFILE = {
  name: "E2E Test Member",
  pronouns: "they/them",
  description: "Created by E2E test to verify encryption round-trip",
  color: "#FF6B9D",
};

const UPDATED_PROFILE = {
  name: "E2E Test Member (Updated)",
  pronouns: "she/her",
  description: "Updated by E2E test",
  color: "#4ECDC4",
};

test.describe("Members CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("create, read with encryption round-trip, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;

    // Create with encrypted data
    const encryptedData = encryptForApi(MEMBER_PROFILE);
    const createRes = await request.post(membersUrl, {
      headers: authHeaders,
      data: { encryptedData },
    });
    expect(createRes.status()).toBe(201);
    const member = await createRes.json();
    expect(member).toHaveProperty("id");
    const memberId = member.id as string;

    // Get and verify encryption round-trip
    const getRes = await request.get(`${membersUrl}/${memberId}`, { headers: authHeaders });
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(memberId);

    const decrypted = decryptFromApi(fetched.encryptedData as string);
    expect(decrypted).toEqual(MEMBER_PROFILE);

    // List
    const listRes = await request.get(membersUrl, { headers: authHeaders });
    expect(listRes.status()).toBe(200);
    const listed = await listRes.json();
    expect(listed.items.length).toBeGreaterThanOrEqual(1);

    // Update with new encrypted data
    const updatedEncryptedData = encryptForApi(UPDATED_PROFILE);
    const updateRes = await request.put(`${membersUrl}/${memberId}`, {
      headers: authHeaders,
      data: {
        encryptedData: updatedEncryptedData,
        version: fetched.version as number,
      },
    });
    expect(updateRes.status()).toBe(200);

    // Verify updated data decrypts correctly
    const updatedGet = await request.get(`${membersUrl}/${memberId}`, { headers: authHeaders });
    const updatedMember = await updatedGet.json();
    const decryptedUpdate = decryptFromApi(updatedMember.encryptedData as string);
    expect(decryptedUpdate).toEqual(UPDATED_PROFILE);

    // Archive
    const archiveRes = await request.post(`${membersUrl}/${memberId}/archive`, {
      headers: authHeaders,
    });
    expect(archiveRes.status()).toBe(204);

    // Restore
    const restoreRes = await request.post(`${membersUrl}/${memberId}/restore`, {
      headers: authHeaders,
    });
    expect(restoreRes.status()).toBe(200);

    // Delete
    const deleteRes = await request.delete(`${membersUrl}/${memberId}`, {
      headers: authHeaders,
    });
    expect(deleteRes.status()).toBe(204);

    // Verify deleted
    const deletedGet = await request.get(`${membersUrl}/${memberId}`, { headers: authHeaders });
    expect(deletedGet.status()).toBe(404);
  });

  test("cross-system member access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems/sys_00000000-0000-0000-0000-000000000000/members", {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });
});
