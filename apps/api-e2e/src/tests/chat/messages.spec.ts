import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createChannel, createMessage, getSystemId } from "../../fixtures/entity-helpers.js";

const MESSAGE_DATA = { content: "Hello from E2E" };
const UPDATED_MESSAGE_DATA = { content: "Hello from E2E (edited)" };

test.describe("Messages CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("message lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId);
    const messagesUrl = `/v1/systems/${systemId}/channels/${channel.id}/messages`;
    let messageId: string;
    let messageVersion: number;

    await test.step("create message", async () => {
      const res = await request.post(messagesUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(MESSAGE_DATA),
          timestamp: Date.now(),
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.id).toMatch(/^msg_/);
      expect(body.data.channelId).toBe(channel.id);
      expect(body.data.replyToId).toBeNull();
      expect(body.data.editedAt).toBeNull();
      messageId = body.data.id as string;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${messagesUrl}/${messageId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(messageId);
      const decrypted = decryptFromApi(body.data.encryptedData as string);
      expect(decrypted).toEqual(MESSAGE_DATA);
      messageVersion = body.data.version as number;
    });

    await test.step("list includes created message", async () => {
      const res = await request.get(messagesUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("hasMore");
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    await test.step("update sets editedAt", async () => {
      const res = await request.put(`${messagesUrl}/${messageId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_MESSAGE_DATA),
          version: messageVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.version).toBe(messageVersion + 1);
      expect(body.data.editedAt).not.toBeNull();
      messageVersion = body.data.version as number;
    });

    await test.step("archive message", async () => {
      const res = await request.post(`${messagesUrl}/${messageId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("archived message not returned by get", async () => {
      const res = await request.get(`${messagesUrl}/${messageId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });

    await test.step("restore message", async () => {
      const res = await request.post(`${messagesUrl}/${messageId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.archived).toBe(false);
    });

    await test.step("delete message (leaf entity)", async () => {
      const res = await request.delete(`${messagesUrl}/${messageId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted message returns 404", async () => {
      const res = await request.get(`${messagesUrl}/${messageId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("message with replyToId", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId);
    const messagesUrl = `/v1/systems/${systemId}/channels/${channel.id}/messages`;

    const original = await createMessage(request, authHeaders, systemId, channel.id, "Original");

    const res = await request.post(messagesUrl, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ content: "Reply" }),
        timestamp: Date.now(),
        replyToId: original.id,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.replyToId).toBe(original.id);
  });

  test("messages list in descending timestamp order with pagination", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId);
    const messagesUrl = `/v1/systems/${systemId}/channels/${channel.id}/messages`;

    const baseTs = Date.now();
    for (let i = 0; i < 3; i++) {
      await request.post(messagesUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ content: `Message ${String(i)}` }),
          timestamp: baseTs + i * 1000,
        },
      });
    }

    const page1Res = await request.get(`${messagesUrl}?limit=2`, {
      headers: authHeaders,
    });
    expect(page1Res.status()).toBe(200);
    const page1 = await page1Res.json();
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    // Descending: newest first
    const items = page1.data as Array<{ timestamp: number }>;
    expect(items[0]?.timestamp).toBeGreaterThan(items[1]?.timestamp ?? 0);

    const page2Res = await request.get(
      `${messagesUrl}?limit=2&cursor=${encodeURIComponent(String(page1.nextCursor))}`,
      { headers: authHeaders },
    );
    expect(page2Res.status()).toBe(200);
    const page2 = await page2Res.json();
    expect(page2.data).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  test("get message with optional timestamp query param", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId);
    const messagesUrl = `/v1/systems/${systemId}/channels/${channel.id}/messages`;
    const msg = await createMessage(request, authHeaders, systemId, channel.id);

    const res = await request.get(`${messagesUrl}/${msg.id}?timestamp=${String(msg.timestamp)}`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(msg.id);
  });

  test("create message in nonexistent channel returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.post(
      `/v1/systems/${systemId}/channels/ch_00000000-0000-0000-0000-000000000000/messages`,
      {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ content: "Orphan" }),
          timestamp: Date.now(),
        },
      },
    );
    expect(res.status()).toBe(404);
  });

  test("delete channel with messages returns 409 HAS_DEPENDENTS", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const channel = await createChannel(request, authHeaders, systemId);
    await createMessage(request, authHeaders, systemId, channel.id);

    const res = await request.delete(`/v1/systems/${systemId}/channels/${channel.id}`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(
      "/v1/systems/sys_00000000-0000-0000-0000-000000000000/channels/ch_00000000-0000-0000-0000-000000000000/messages",
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
