import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Communication Webhook Delivery", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("channel.created event triggers webhook delivery", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Step 1: Create a webhook config subscribing to "channel.created"
    let webhookId: string;
    await test.step("create webhook config for channel.created", async () => {
      const res = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/comm-webhook",
          eventTypes: ["channel.created"],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      webhookId = body.id as string;
    });

    // Step 2: Trigger the event by creating a channel
    let channelId: string;
    await test.step("create channel to trigger event", async () => {
      const res = await request.post(`/v1/systems/${systemId}/channels`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Webhook Test Channel" }),
          type: "channel",
          sortOrder: 0,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      channelId = body.id as string;
    });

    // Step 3: Query deliveries for this webhook and verify one was created
    await test.step("verify delivery record created", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      const deliveries = body.items as Array<{
        eventType: string;
        status: string;
        webhookId: string;
      }>;
      const channelDelivery = deliveries.find(
        (d) => d.eventType === "channel.created" && d.webhookId === webhookId,
      );
      expect(channelDelivery).toBeDefined();
      if (channelDelivery) expect(channelDelivery.status).toBe("pending");
    });

    // Cleanup: delete webhook config (need to delete deliveries first)
    await test.step("cleanup", async () => {
      // Delete all deliveries for this webhook
      const deliveriesRes = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      const deliveries = (await deliveriesRes.json()).items as Array<{ id: string }>;
      for (const d of deliveries) {
        await request.delete(`/v1/systems/${systemId}/webhook-deliveries/${d.id}`, {
          headers: authHeaders,
        });
      }
      // Delete channel
      await request.delete(`/v1/systems/${systemId}/channels/${channelId}`, {
        headers: authHeaders,
      });
      // Delete webhook config
      await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
    });
  });

  test("poll.created event triggers webhook delivery", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    let webhookId: string;
    await test.step("create webhook config for poll.created", async () => {
      const res = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/poll-webhook",
          eventTypes: ["poll.created"],
        },
      });
      expect(res.status()).toBe(201);
      webhookId = (await res.json()).id as string;
    });

    let pollId: string;
    await test.step("create poll to trigger event", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({
            title: "Webhook Test Poll",
            description: null,
            options: [],
          }),
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        },
      });
      expect(res.status()).toBe(201);
      pollId = (await res.json()).id as string;
    });

    await test.step("verify delivery record created", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const deliveries = (await res.json()).items as Array<{
        eventType: string;
        webhookId: string;
        status: string;
      }>;
      const pollDelivery = deliveries.find(
        (d) => d.eventType === "poll.created" && d.webhookId === webhookId,
      );
      expect(pollDelivery).toBeDefined();
      if (pollDelivery) expect(pollDelivery.status).toBe("pending");
    });

    // Cleanup
    await test.step("cleanup", async () => {
      const deliveriesRes = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      const deliveries = (await deliveriesRes.json()).items as Array<{ id: string }>;
      for (const d of deliveries) {
        await request.delete(`/v1/systems/${systemId}/webhook-deliveries/${d.id}`, {
          headers: authHeaders,
        });
      }
      await request.delete(`/v1/systems/${systemId}/polls/${pollId}`, { headers: authHeaders });
      await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
    });
  });

  test("acknowledgement.created event triggers webhook delivery", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);

    let webhookId: string;
    await test.step("create webhook config for acknowledgement.created", async () => {
      const res = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/ack-webhook",
          eventTypes: ["acknowledgement.created"],
        },
      });
      expect(res.status()).toBe(201);
      webhookId = (await res.json()).id as string;
    });

    let ackId: string;
    await test.step("create acknowledgement to trigger event", async () => {
      const res = await request.post(`/v1/systems/${systemId}/acknowledgements`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({
            message: "Webhook test ack",
            targetMemberId: "mem_00000000-0000-0000-0000-000000000001",
          }),
        },
      });
      expect(res.status()).toBe(201);
      ackId = (await res.json()).id as string;
    });

    await test.step("verify delivery record created", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const deliveries = (await res.json()).items as Array<{
        eventType: string;
        webhookId: string;
        status: string;
      }>;
      const ackDelivery = deliveries.find(
        (d) => d.eventType === "acknowledgement.created" && d.webhookId === webhookId,
      );
      expect(ackDelivery).toBeDefined();
      if (ackDelivery) expect(ackDelivery.status).toBe("pending");
    });

    // Cleanup
    await test.step("cleanup", async () => {
      const deliveriesRes = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      const deliveries = (await deliveriesRes.json()).items as Array<{ id: string }>;
      for (const d of deliveries) {
        await request.delete(`/v1/systems/${systemId}/webhook-deliveries/${d.id}`, {
          headers: authHeaders,
        });
      }
      await request.delete(`/v1/systems/${systemId}/acknowledgements/${ackId}`, {
        headers: authHeaders,
      });
      await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
    });
  });

  test("unsubscribed event type does NOT trigger delivery", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    let webhookId: string;
    await test.step("create webhook config for note.created only", async () => {
      const res = await request.post(`/v1/systems/${systemId}/webhook-configs`, {
        headers: authHeaders,
        data: {
          url: "https://example.com/note-only-webhook",
          eventTypes: ["note.created"],
        },
      });
      expect(res.status()).toBe(201);
      webhookId = (await res.json()).id as string;
    });

    await test.step("create poll (unsubscribed event)", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({
            title: "No delivery poll",
            description: null,
            options: [],
          }),
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        },
      });
      expect(res.status()).toBe(201);
    });

    await test.step("verify no delivery for unsubscribed event", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const deliveries = (await res.json()).items as Array<{
        eventType: string;
        webhookId: string;
      }>;
      const pollDelivery = deliveries.find(
        (d) => d.eventType === "poll.created" && d.webhookId === webhookId,
      );
      expect(pollDelivery).toBeUndefined();
    });

    // Cleanup
    await test.step("cleanup", async () => {
      await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
        headers: authHeaders,
      });
    });
  });
});
