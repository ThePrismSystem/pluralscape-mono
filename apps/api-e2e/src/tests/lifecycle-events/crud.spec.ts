import {
  assertIdorRejected,
  assertRequiresAuth,
  assertValidationRejects,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createLifecycleEvent, getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK } from "../../fixtures/http.constants.js";

test.describe("Lifecycle events CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("event lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const eventsUrl = `/v1/systems/${systemId}/lifecycle-events`;
    let eventId: string;
    let eventVersion: number;

    await test.step("create lifecycle event", async () => {
      const res = await request.post(eventsUrl, {
        headers: authHeaders,
        data: {
          eventType: "discovery",
          occurredAt: Date.now(),
          encryptedData: encryptForApi({ description: "System discovered" }),
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string; version: number } };
      eventId = body.data.id;
      eventVersion = body.data.version;
    });

    await test.step("get event", async () => {
      const res = await request.get(`${eventsUrl}/${eventId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("list includes event", async () => {
      const res = await request.get(eventsUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((e) => e.id)).toContain(eventId);
    });

    await test.step("update event", async () => {
      const res = await request.put(`${eventsUrl}/${eventId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ description: "Updated description" }),
          version: eventVersion,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { version: number } };
      eventVersion = body.data.version;
    });

    await test.step("update with metadata", async () => {
      const res = await request.put(`${eventsUrl}/${eventId}`, {
        headers: authHeaders,
        data: {
          eventType: "name-change",
          occurredAt: Date.now() - 86_400_000,
          encryptedData: encryptForApi({ description: "With metadata" }),
          version: eventVersion,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("archive event", async () => {
      const res = await request.post(`${eventsUrl}/${eventId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("restore event", async () => {
      const res = await request.post(`${eventsUrl}/${eventId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete event", async () => {
      const res = await request.delete(`${eventsUrl}/${eventId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/lifecycle-events`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/lifecycle-events`,
      secondAuthHeaders,
    );
  });

  test("list returns multiple events", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await createLifecycleEvent(request, authHeaders, systemId);
    await createLifecycleEvent(request, authHeaders, systemId, { eventType: "archival" });

    const res = await request.get(`/v1/systems/${systemId}/lifecycle-events`, {
      headers: authHeaders,
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { data: unknown[]; hasMore: boolean };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test("validation rejects bad input", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertValidationRejects(
      request,
      "POST",
      `/v1/systems/${systemId}/lifecycle-events`,
      authHeaders,
      [{}, { eventType: 123 }, { eventType: "discovery" }],
    );
  });
});
