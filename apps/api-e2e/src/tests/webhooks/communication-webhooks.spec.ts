import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

import type { APIRequestContext } from "@playwright/test";

/**
 * Clean up webhook deliveries, entities, and the webhook config after a test.
 * Asserts response codes on every delete to avoid silently swallowed failures.
 */
async function cleanupWebhookTest(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  webhookId: string,
  entityCleanups: Array<{ path: string; expectedStatus?: number }>,
): Promise<void> {
  const deliveriesRes = await request.get(
    `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
    { headers },
  );
  expect(deliveriesRes.status()).toBe(200);
  const deliveries = (await deliveriesRes.json()).data as Array<{ id: string }>;
  for (const d of deliveries) {
    const delRes = await request.delete(`/v1/systems/${systemId}/webhook-deliveries/${d.id}`, {
      headers,
    });
    expect(delRes.ok()).toBe(true);
  }

  for (const cleanup of entityCleanups) {
    const res = await request.delete(cleanup.path, { headers });
    expect(res.status()).toBe(cleanup.expectedStatus ?? 204);
  }

  const whRes = await request.delete(`/v1/systems/${systemId}/webhook-configs/${webhookId}`, {
    headers,
  });
  expect(whRes.ok()).toBe(true);
}

test.describe("Communication Webhook Delivery", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("channel.created event triggers webhook delivery", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

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

    await test.step("verify delivery record created", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      const deliveries = body.data as Array<{
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

    await test.step("cleanup", async () => {
      await cleanupWebhookTest(request, authHeaders, systemId, webhookId, [
        { path: `/v1/systems/${systemId}/channels/${channelId}` },
      ]);
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
      const deliveries = (await res.json()).data as Array<{
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

    await test.step("cleanup", async () => {
      await cleanupWebhookTest(request, authHeaders, systemId, webhookId, [
        { path: `/v1/systems/${systemId}/polls/${pollId}` },
      ]);
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
      const deliveries = (await res.json()).data as Array<{
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

    await test.step("cleanup", async () => {
      await cleanupWebhookTest(request, authHeaders, systemId, webhookId, [
        { path: `/v1/systems/${systemId}/acknowledgements/${ackId}` },
      ]);
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

    let pollId: string;
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
      pollId = (await res.json()).id as string;
    });

    await test.step("verify no delivery for unsubscribed event", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/webhook-deliveries?webhookId=${webhookId}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const deliveries = (await res.json()).data as Array<{
        eventType: string;
        webhookId: string;
      }>;
      const pollDelivery = deliveries.find(
        (d) => d.eventType === "poll.created" && d.webhookId === webhookId,
      );
      expect(pollDelivery).toBeUndefined();
    });

    await test.step("cleanup", async () => {
      await cleanupWebhookTest(request, authHeaders, systemId, webhookId, [
        { path: `/v1/systems/${systemId}/polls/${pollId}` },
      ]);
    });
  });
});
