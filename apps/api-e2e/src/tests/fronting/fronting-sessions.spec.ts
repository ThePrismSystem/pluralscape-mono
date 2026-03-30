import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Fronting Sessions", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("fronting session lifecycle: create, list, get, update, end, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    let sessionId: string;
    let memberId: string;

    await test.step("create member", async () => {
      const member = await createMember(request, authHeaders, systemId, "E2E Fronting Member");
      memberId = member.id;
    });

    await test.step("create session", async () => {
      const res = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "E2E fronting session" }),
          startTime: Date.now(),
          memberId,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      const session = (body as { data: Record<string, unknown> }).data;
      expect(session).toHaveProperty("id");
      expect(session.systemId).toBe(systemId);
      expect(session.startTime).toBeTruthy();
      expect(session.endTime).toBeNull();
      expect(session.memberId).toBe(memberId);
      sessionId = session.id as string;
    });

    await test.step("list sessions", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const ids = (body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(sessionId);
    });

    await test.step("list active only", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions?activeOnly=true`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const ids = (body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(sessionId);
    });

    await test.step("get by ID", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions/${sessionId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const session = (body as { data: Record<string, unknown> }).data;
      expect(session.id).toBe(sessionId);
      expect(session.encryptedData).toBeTruthy();
    });

    await test.step("update", async () => {
      const res = await request.put(`/v1/systems/${systemId}/fronting-sessions/${sessionId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "Updated fronting session" }),
          version: 1,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const session = (body as { data: Record<string, unknown> }).data;
      expect(session.version).toBe(2);
    });

    await test.step("end session", async () => {
      const res = await request.post(`/v1/systems/${systemId}/fronting-sessions/${sessionId}/end`, {
        headers: authHeaders,
        data: {
          endTime: Date.now(),
          version: 2,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const session = (body as { data: Record<string, unknown> }).data;
      expect(session.endTime).not.toBeNull();
    });

    await test.step("archive", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-sessions/${sessionId}/archive`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(204);
    });

    await test.step("restore", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-sessions/${sessionId}/restore`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);
    });

    await test.step("delete", async () => {
      const res = await request.delete(`/v1/systems/${systemId}/fronting-sessions/${sessionId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("verify deleted", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions/${sessionId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("co-fronting: two simultaneous sessions", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    let memberAId: string;
    let memberBId: string;
    let sessionAId: string;
    let sessionBId: string;

    await test.step("create two members", async () => {
      const memberA = await createMember(request, authHeaders, systemId, "E2E Fronting Member");
      const memberB = await createMember(request, authHeaders, systemId, "E2E Fronting Member");
      memberAId = memberA.id;
      memberBId = memberB.id;
    });

    await test.step("create session for member A", async () => {
      const res = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "Member A fronting" }),
          startTime: Date.now(),
          memberId: memberAId,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      sessionAId = (body as { data: { id: string } }).data.id;
    });

    await test.step("create session for member B", async () => {
      const res = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "Member B fronting" }),
          startTime: Date.now(),
          memberId: memberBId,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      sessionBId = (body as { data: { id: string } }).data.id;
    });

    await test.step("list active sessions includes both", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions?activeOnly=true`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const ids = (body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(sessionAId);
      expect(ids).toContain(sessionBId);
    });

    await test.step("end member A session", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-sessions/${sessionAId}/end`,
        {
          headers: authHeaders,
          data: {
            endTime: Date.now(),
            version: 1,
          },
        },
      );
      expect(res.status()).toBe(200);
    });

    await test.step("list active shows only member B", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-sessions?activeOnly=true`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const ids = (body.data as { id: string }[]).map((s) => s.id);
      expect(ids).not.toContain(sessionAId);
      expect(ids).toContain(sessionBId);
    });

    await test.step("end member B session", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-sessions/${sessionBId}/end`,
        {
          headers: authHeaders,
          data: {
            endTime: Date.now(),
            version: 1,
          },
        },
      );
      expect(res.status()).toBe(200);
    });
  });
});
