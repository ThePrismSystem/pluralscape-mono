import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

interface BmResponse {
  id: string;
  systemId: string;
  pinned: boolean;
  sortOrder: number;
  encryptedData: string;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface BmListResponse {
  items: BmResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

const BM_DATA = { content: "Remember to check in today!", senderId: "mem_test" };
const UPDATED_BM_DATA = { content: "Updated board message", senderId: "mem_test" };

test.describe("Board Messages CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("board message lifecycle: create, get, list, update, pin/unpin, reorder, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;
    let bmId: string;
    let bmVersion: number;

    await test.step("create board message", async () => {
      const res = await request.post(bmUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(BM_DATA),
          sortOrder: 0,
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as BmResponse;
      expect(body.id).toMatch(/^bm_/);
      expect(body.pinned).toBe(false);
      expect(body.sortOrder).toBe(0);
      expect(body.version).toBe(1);
      expect(body.archived).toBe(false);
      bmId = body.id;
      bmVersion = body.version;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${bmUrl}/${bmId}`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmResponse;
      expect(body.id).toBe(bmId);
      const decrypted = decryptFromApi(body.encryptedData);
      expect(decrypted).toEqual(BM_DATA);
    });

    await test.step("list includes created board message", async () => {
      const res = await request.get(bmUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmListResponse;
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("hasMore");
      expect(body.items.some((item) => item.id === bmId)).toBe(true);
    });

    await test.step("update with new encrypted data", async () => {
      const res = await request.put(`${bmUrl}/${bmId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_BM_DATA),
          version: bmVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmResponse;
      expect(body.version).toBe(bmVersion + 1);
      bmVersion = body.version;
    });

    await test.step("pin board message", async () => {
      const res = await request.post(`${bmUrl}/${bmId}/pin`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmResponse;
      expect(body.pinned).toBe(true);
      bmVersion = body.version;
    });

    await test.step("unpin board message", async () => {
      const res = await request.post(`${bmUrl}/${bmId}/unpin`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmResponse;
      expect(body.pinned).toBe(false);
      bmVersion = body.version;
    });

    await test.step("archive board message", async () => {
      const res = await request.post(`${bmUrl}/${bmId}/archive`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("archived not returned by default list", async () => {
      const res = await request.get(bmUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmListResponse;
      expect(body.items.every((item) => item.id !== bmId)).toBe(true);
    });

    await test.step("archived returned with includeArchived=true", async () => {
      const res = await request.get(`${bmUrl}?includeArchived=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmListResponse;
      expect(body.items.some((item) => item.id === bmId)).toBe(true);
    });

    await test.step("restore board message", async () => {
      const res = await request.post(`${bmUrl}/${bmId}/restore`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as BmResponse;
      expect(body.archived).toBe(false);
      bmVersion = body.version;
    });

    await test.step("delete board message", async () => {
      const res = await request.delete(`${bmUrl}/${bmId}`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted board message returns 404", async () => {
      const res = await request.get(`${bmUrl}/${bmId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("reorder board messages", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    // Create two board messages
    const res1 = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ content: "First", senderId: "mem_1" }), sortOrder: 0 },
    });
    expect(res1.status()).toBe(201);
    const bm1 = (await res1.json()) as BmResponse;

    const res2 = await request.post(bmUrl, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ content: "Second", senderId: "mem_2" }),
        sortOrder: 1,
      },
    });
    expect(res2.status()).toBe(201);
    const bm2 = (await res2.json()) as BmResponse;

    // Reorder: swap sortOrders
    const reorderRes = await request.post(`${bmUrl}/reorder`, {
      headers: authHeaders,
      data: {
        operations: [
          { boardMessageId: bm1.id, sortOrder: 1 },
          { boardMessageId: bm2.id, sortOrder: 0 },
        ],
      },
    });
    expect(reorderRes.status()).toBe(204);

    // Verify sortOrders updated
    const getRes1 = await request.get(`${bmUrl}/${bm1.id}`, { headers: authHeaders });
    const body1 = (await getRes1.json()) as BmResponse;
    expect(body1.sortOrder).toBe(1);

    const getRes2 = await request.get(`${bmUrl}/${bm2.id}`, { headers: authHeaders });
    const body2 = (await getRes2.json()) as BmResponse;
    expect(body2.sortOrder).toBe(0);
  });

  test("list filtered by pinned", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    // Create a pinned and unpinned message
    const res = await request.post(bmUrl, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ content: "Pinned!", senderId: "mem_1" }),
        sortOrder: 0,
        pinned: true,
      },
    });
    expect(res.status()).toBe(201);

    const pinnedRes = await request.get(`${bmUrl}?pinned=true`, { headers: authHeaders });
    expect(pinnedRes.status()).toBe(200);
    const pinnedBody = (await pinnedRes.json()) as BmListResponse;
    for (const item of pinnedBody.items) {
      expect(item.pinned).toBe(true);
    }
  });

  test("update with wrong version returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const createRes = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(BM_DATA), sortOrder: 0 },
    });
    const bm = (await createRes.json()) as BmResponse;

    const res = await request.put(`${bmUrl}/${bm.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(UPDATED_BM_DATA), version: 999 },
    });
    expect(res.status()).toBe(409);
  });

  test("archive already archived returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const createRes = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(BM_DATA), sortOrder: 0 },
    });
    const bm = (await createRes.json()) as BmResponse;

    await request.post(`${bmUrl}/${bm.id}/archive`, { headers: authHeaders });

    const res = await request.post(`${bmUrl}/${bm.id}/archive`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });

  test("restore non-archived returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const createRes = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(BM_DATA), sortOrder: 0 },
    });
    const bm = (await createRes.json()) as BmResponse;

    const res = await request.post(`${bmUrl}/${bm.id}/restore`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });

  test("reorder with non-existent ID returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const res = await request.post(`${bmUrl}/reorder`, {
      headers: authHeaders,
      data: {
        operations: [{ boardMessageId: "bm_00000000-0000-0000-0000-000000000000", sortOrder: 0 }],
      },
    });
    expect(res.status()).toBe(404);
  });

  test("pin already pinned returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const createRes = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(BM_DATA), sortOrder: 0, pinned: true },
    });
    const bm = (await createRes.json()) as BmResponse;

    const res = await request.post(`${bmUrl}/${bm.id}/pin`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });

  test("unpin non-pinned returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bmUrl = `/v1/systems/${systemId}/board-messages`;

    const createRes = await request.post(bmUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(BM_DATA), sortOrder: 0 },
    });
    const bm = (await createRes.json()) as BmResponse;

    const res = await request.post(`${bmUrl}/${bm.id}/unpin`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });
});
