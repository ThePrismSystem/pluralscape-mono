import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Timer Config and Check-In Records", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("timer config and check-in lifecycle", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    let memberId: string;
    let timerId: string;
    let recordId: string;
    let record2Id: string;

    await test.step("create member", async () => {
      const member = await createMember(request, authHeaders, systemId, "E2E Timer Member");
      memberId = member.id;
    });

    await test.step("create timer config", async () => {
      const res = await request.post(`/v1/systems/${systemId}/timer-configs`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ label: "E2E check-in timer" }),
        },
      });
      expect(res.status()).toBe(201);
      const timer = await res.json();
      expect(timer).toHaveProperty("id");
      expect(timer.enabled).toBe(true);
      timerId = timer.id as string;
    });

    await test.step("get timer config", async () => {
      const res = await request.get(`/v1/systems/${systemId}/timer-configs/${timerId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const timer = await res.json();
      expect(timer.id).toBe(timerId);
    });

    await test.step("create check-in record", async () => {
      const res = await request.post(`/v1/systems/${systemId}/check-in-records`, {
        headers: authHeaders,
        data: {
          timerConfigId: timerId,
          scheduledAt: Date.now(),
        },
      });
      expect(res.status()).toBe(201);
      const record = await res.json();
      expect(record).toHaveProperty("id");
      expect(record.dismissed).toBe(false);
      expect(record.respondedAt).toBeNull();
      recordId = record.id as string;
    });

    await test.step("list check-in records", async () => {
      const res = await request.get(`/v1/systems/${systemId}/check-in-records`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const ids = (body.data as { id: string }[]).map((r) => r.id);
      expect(ids).toContain(recordId);
    });

    await test.step("respond to check-in", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/check-in-records/${recordId}/respond`,
        {
          headers: authHeaders,
          data: {
            respondedByMemberId: memberId,
          },
        },
      );
      expect(res.status()).toBe(200);
      const record = await res.json();
      expect(record.respondedAt).not.toBeNull();
      expect(record.respondedByMemberId).toBe(memberId);
    });

    await test.step("create second check-in for dismiss test", async () => {
      const res = await request.post(`/v1/systems/${systemId}/check-in-records`, {
        headers: authHeaders,
        data: {
          timerConfigId: timerId,
          scheduledAt: Date.now() + 1000,
        },
      });
      expect(res.status()).toBe(201);
      const record = await res.json();
      record2Id = record.id as string;
    });

    await test.step("dismiss check-in", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/check-in-records/${record2Id}/dismiss`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
      const record = await res.json();
      expect(record.dismissed).toBe(true);
    });

    await test.step("archive timer config", async () => {
      const res = await request.post(`/v1/systems/${systemId}/timer-configs/${timerId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });
  });
});
