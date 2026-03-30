import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createChannel, getSystemId } from "../../fixtures/entity-helpers.js";

const CHANNEL_DATA = { name: "General Chat" };
const UPDATED_CHANNEL_DATA = { name: "General Chat (Renamed)" };

test.describe("Channels CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("channel lifecycle: create category, create channel, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channelsUrl = `/v1/systems/${systemId}/channels`;
    let categoryId: string;
    let channelId: string;
    let channelVersion: number;

    await test.step("create category", async () => {
      const res = await request.post(channelsUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Text Channels" }),
          type: "category",
          sortOrder: 0,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.type).toBe("category");
      expect(body.data.parentId).toBeNull();
      categoryId = body.data.id as string;
    });

    await test.step("create channel under category", async () => {
      const res = await request.post(channelsUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(CHANNEL_DATA),
          type: "channel",
          parentId: categoryId,
          sortOrder: 0,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.type).toBe("channel");
      expect(body.data.parentId).toBe(categoryId);
      channelId = body.data.id as string;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${channelsUrl}/${channelId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(channelId);
      const decrypted = decryptFromApi(body.data.encryptedData as string);
      expect(decrypted).toEqual(CHANNEL_DATA);
      channelVersion = body.data.version as number;
    });

    await test.step("list includes created channels", async () => {
      const res = await request.get(channelsUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("hasMore");
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    await test.step("list filtered by type=category", async () => {
      const res = await request.get(`${channelsUrl}?type=category`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      for (const item of body.data) {
        expect(item.type).toBe("category");
      }
    });

    await test.step("list filtered by parentId", async () => {
      const res = await request.get(`${channelsUrl}?parentId=${categoryId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].parentId).toBe(categoryId);
    });

    await test.step("update with new encrypted data", async () => {
      const res = await request.put(`${channelsUrl}/${channelId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_CHANNEL_DATA),
          version: channelVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.version).toBe(channelVersion + 1);
    });

    await test.step("archive channel", async () => {
      const res = await request.post(`${channelsUrl}/${channelId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("archived channel not returned by get", async () => {
      const res = await request.get(`${channelsUrl}/${channelId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });

    await test.step("restore channel", async () => {
      const res = await request.post(`${channelsUrl}/${channelId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.archived).toBe(false);
    });

    await test.step("delete channel (no dependents)", async () => {
      const res = await request.delete(`${channelsUrl}/${channelId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted channel returns 404", async () => {
      const res = await request.get(`${channelsUrl}/${channelId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("reject category with parentId", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const category = await createChannel(request, authHeaders, systemId, {
      type: "category",
    });

    const res = await request.post(`/v1/systems/${systemId}/channels`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ name: "Bad Category" }),
        type: "category",
        parentId: category.id,
        sortOrder: 0,
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_HIERARCHY");
  });

  test("reject channel with non-category parent", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId, {
      type: "channel",
    });

    const res = await request.post(`/v1/systems/${systemId}/channels`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ name: "Bad Child" }),
        type: "channel",
        parentId: channel.id,
        sortOrder: 0,
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_HIERARCHY");
  });

  test("delete category with children returns 409 HAS_DEPENDENTS", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const category = await createChannel(request, authHeaders, systemId, {
      type: "category",
    });
    await createChannel(request, authHeaders, systemId, {
      type: "channel",
      parentId: category.id,
    });

    const res = await request.delete(`/v1/systems/${systemId}/channels/${category.id}`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems/sys_00000000-0000-0000-0000-000000000000/channels", {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });
});
