import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createGroup, createMember, getSystemId } from "../../fixtures/entity-helpers.js";

const GROUP_PROFILE = {
  name: "E2E Test Group",
  description: "Created by E2E test to verify encryption round-trip",
  color: "#FF6B9D",
};

const UPDATED_GROUP_PROFILE = {
  name: "E2E Test Group (Updated)",
  description: "Updated by E2E test",
  color: "#4ECDC4",
};

test.describe("Groups CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("group lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const groupsUrl = `/v1/systems/${systemId}/groups`;
    let groupId: string;
    let groupVersion: number;

    await test.step("create with encrypted data", async () => {
      const encryptedData = encryptForApi(GROUP_PROFILE);
      const createRes = await request.post(groupsUrl, {
        headers: authHeaders,
        data: { encryptedData, parentGroupId: null, sortOrder: 0 },
      });
      expect(createRes.status()).toBe(201);
      const group = await createRes.json();
      expect(group).toHaveProperty("id");
      expect(group).toHaveProperty("version");
      groupId = group.id as string;
      groupVersion = group.version as number;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const getRes = await request.get(`${groupsUrl}/${groupId}`, { headers: authHeaders });
      expect(getRes.status()).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.id).toBe(groupId);

      const decrypted = decryptFromApi(fetched.encryptedData as string);
      expect(decrypted).toEqual(GROUP_PROFILE);
      groupVersion = fetched.version as number;
    });

    await test.step("list includes created group", async () => {
      const listRes = await request.get(groupsUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const listed = await listRes.json();
      expect(listed).toHaveProperty("items");
      expect(listed).toHaveProperty("cursor");
      expect(listed).toHaveProperty("hasMore");
      expect(listed.items.length).toBeGreaterThanOrEqual(1);

      const found = (listed.items as Array<{ id: string }>).some((g) => g.id === groupId);
      expect(found).toBe(true);
    });

    await test.step("update with new encrypted data", async () => {
      const updatedEncryptedData = encryptForApi(UPDATED_GROUP_PROFILE);
      const updateRes = await request.put(`${groupsUrl}/${groupId}`, {
        headers: authHeaders,
        data: {
          encryptedData: updatedEncryptedData,
          version: groupVersion,
        },
      });
      expect(updateRes.status()).toBe(200);

      const updatedGet = await request.get(`${groupsUrl}/${groupId}`, { headers: authHeaders });
      const updatedGroup = await updatedGet.json();
      const decryptedUpdate = decryptFromApi(updatedGroup.encryptedData as string);
      expect(decryptedUpdate).toEqual(UPDATED_GROUP_PROFILE);
      groupVersion = updatedGroup.version as number;
    });

    await test.step("archive", async () => {
      const archiveRes = await request.post(`${groupsUrl}/${groupId}/archive`, {
        headers: authHeaders,
      });
      expect(archiveRes.status()).toBe(200);
    });

    await test.step("restore", async () => {
      const restoreRes = await request.post(`${groupsUrl}/${groupId}/restore`, {
        headers: authHeaders,
      });
      expect(restoreRes.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const deleteRes = await request.delete(`${groupsUrl}/${groupId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(200);
    });

    await test.step("verify deleted returns 404", async () => {
      const deletedGet = await request.get(`${groupsUrl}/${groupId}`, { headers: authHeaders });
      expect(deletedGet.status()).toBe(404);
    });
  });

  test("group tree hierarchy", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const groupsUrl = `/v1/systems/${systemId}/groups`;

    const parent = await createGroup(request, authHeaders, systemId, { name: "Tree Parent" });
    const child = await createGroup(request, authHeaders, systemId, {
      name: "Tree Child",
      parentGroupId: parent.id,
    });

    const treeRes = await request.get(`${groupsUrl}/tree`, { headers: authHeaders });
    expect(treeRes.status()).toBe(200);
    const tree = (await treeRes.json()) as Array<{
      id: string;
      children?: Array<{ id: string }>;
    }>;

    const parentNode = tree.find((node) => node.id === parent.id);
    expect(parentNode).toBeDefined();
    expect(parentNode?.children).toBeDefined();
    const childNode = parentNode?.children?.find((c) => c.id === child.id);
    expect(childNode).toBeDefined();

    // Cleanup
    await request.delete(`${groupsUrl}/${child.id}`, { headers: authHeaders });
    await request.delete(`${groupsUrl}/${parent.id}`, { headers: authHeaders });
  });

  test("move group between parents", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const groupsUrl = `/v1/systems/${systemId}/groups`;

    const parentA = await createGroup(request, authHeaders, systemId, { name: "Parent A" });
    const parentB = await createGroup(request, authHeaders, systemId, { name: "Parent B" });
    const child = await createGroup(request, authHeaders, systemId, {
      name: "Movable Child",
      parentGroupId: parentA.id,
    });

    const moveRes = await request.post(`${groupsUrl}/${child.id}/move`, {
      headers: authHeaders,
      data: { targetParentGroupId: parentB.id, version: child.version },
    });
    expect(moveRes.status()).toBe(200);

    const treeRes = await request.get(`${groupsUrl}/tree`, { headers: authHeaders });
    expect(treeRes.status()).toBe(200);
    const tree = (await treeRes.json()) as Array<{
      id: string;
      children?: Array<{ id: string }>;
    }>;

    const parentANode = tree.find((node) => node.id === parentA.id);
    const parentBNode = tree.find((node) => node.id === parentB.id);

    const stillInA = parentANode?.children?.some((c) => c.id === child.id) ?? false;
    expect(stillInA).toBe(false);

    const movedToB = parentBNode?.children?.some((c) => c.id === child.id) ?? false;
    expect(movedToB).toBe(true);

    // Cleanup
    await request.delete(`${groupsUrl}/${child.id}`, { headers: authHeaders });
    await request.delete(`${groupsUrl}/${parentB.id}`, { headers: authHeaders });
    await request.delete(`${groupsUrl}/${parentA.id}`, { headers: authHeaders });
  });

  test("reorder groups", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const groupsUrl = `/v1/systems/${systemId}/groups`;

    const groupA = await createGroup(request, authHeaders, systemId, { name: "Reorder A" });
    const groupB = await createGroup(request, authHeaders, systemId, { name: "Reorder B" });
    const groupC = await createGroup(request, authHeaders, systemId, { name: "Reorder C" });

    const reorderRes = await request.post(`${groupsUrl}/reorder`, {
      headers: authHeaders,
      data: {
        items: [
          { id: groupC.id, sortOrder: 0 },
          { id: groupA.id, sortOrder: 1 },
          { id: groupB.id, sortOrder: 2 },
        ],
      },
    });
    expect(reorderRes.status()).toBe(200);

    const listRes = await request.get(groupsUrl, { headers: authHeaders });
    expect(listRes.status()).toBe(200);
    const listed = await listRes.json();
    const items = listed.items as Array<{ id: string; sortOrder: number }>;

    const sortedIds = items
      .filter((g) => [groupA.id, groupB.id, groupC.id].includes(g.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => g.id);

    expect(sortedIds).toEqual([groupC.id, groupA.id, groupB.id]);

    // Cleanup
    await request.delete(`${groupsUrl}/${groupA.id}`, { headers: authHeaders });
    await request.delete(`${groupsUrl}/${groupB.id}`, { headers: authHeaders });
    await request.delete(`${groupsUrl}/${groupC.id}`, { headers: authHeaders });
  });

  test("group members: add, list, remove", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const groupsUrl = `/v1/systems/${systemId}/groups`;

    const group = await createGroup(request, authHeaders, systemId, { name: "Member Group" });
    const member = await createMember(request, authHeaders, systemId, "Group Member");
    const groupMembersUrl = `${groupsUrl}/${group.id}/members`;

    let addedMemberId: string;

    await test.step("add member to group", async () => {
      const addRes = await request.post(groupMembersUrl, {
        headers: authHeaders,
        data: { memberId: member.id },
      });
      expect(addRes.status()).toBe(201);
      addedMemberId = member.id;
    });

    await test.step("list group members includes added member", async () => {
      const listRes = await request.get(groupMembersUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      const memberIds = (body as Array<{ id?: string; memberId?: string }>).map(
        (m) => m.memberId ?? m.id,
      );
      expect(memberIds).toContain(addedMemberId);
    });

    await test.step("remove member from group", async () => {
      const removeRes = await request.delete(`${groupMembersUrl}/${member.id}`, {
        headers: authHeaders,
      });
      expect(removeRes.status()).toBe(200);
    });

    await test.step("list after removal excludes member", async () => {
      const listRes = await request.get(groupMembersUrl, { headers: authHeaders });
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      const memberIds = (body as Array<{ id?: string; memberId?: string }>).map(
        (m) => m.memberId ?? m.id,
      );
      expect(memberIds).not.toContain(addedMemberId);
    });

    // Cleanup
    await request.delete(`${groupsUrl}/${group.id}`, { headers: authHeaders });
    await request.delete(`/v1/systems/${systemId}/members/${member.id}`, {
      headers: authHeaders,
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const fakeSystemId = "sys_00000000-0000-0000-0000-000000000000";

    const listRes = await request.get(`/v1/systems/${fakeSystemId}/groups`, {
      headers: authHeaders,
    });
    expect(listRes.status()).toBe(404);

    const getRes = await request.get(`/v1/systems/${fakeSystemId}/groups/${fakeSystemId}`, {
      headers: authHeaders,
    });
    expect(getRes.status()).toBe(404);

    const treeRes = await request.get(`/v1/systems/${fakeSystemId}/groups/tree`, {
      headers: authHeaders,
    });
    expect(treeRes.status()).toBe(404);
  });
});
