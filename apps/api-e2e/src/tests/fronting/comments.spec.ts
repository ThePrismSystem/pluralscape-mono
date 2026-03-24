import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createFrontingSession, createMember, getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Fronting Comments CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("fronting comment lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const member = await createMember(request, authHeaders, systemId, "E2E Comment Member");
    const session = await createFrontingSession(request, authHeaders, systemId, [member.id]);

    const baseUrl = `/v1/systems/${systemId}/fronting-sessions/${session.id}/comments`;
    let commentId: string;
    let commentVersion: number;

    await test.step("create comment", async () => {
      const res = await request.post(baseUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ text: "Feeling good today" }),
          memberId: member.id,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty("id");
      expect(body.memberId).toBe(member.id);
      commentId = body.id as string;
      commentVersion = body.version as number;
    });

    await test.step("get comment and verify encryption round-trip", async () => {
      const res = await request.get(`${baseUrl}/${commentId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(commentId);
      expect(body.encryptedData).toBeTruthy();
      const decrypted = decryptFromApi(body.encryptedData as string) as { text: string };
      expect(decrypted.text).toBe("Feeling good today");
    });

    await test.step("list comments", async () => {
      const res = await request.get(baseUrl, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("hasMore");
      const ids = (body.items as { id: string }[]).map((c) => c.id);
      expect(ids).toContain(commentId);
    });

    await test.step("update comment", async () => {
      const res = await request.put(`${baseUrl}/${commentId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ text: "Updated comment text" }),
          version: commentVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.version).toBe(commentVersion + 1);
      commentVersion = body.version as number;
    });

    await test.step("archive comment", async () => {
      const res = await request.post(`${baseUrl}/${commentId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
    });

    await test.step("restore comment", async () => {
      const res = await request.post(`${baseUrl}/${commentId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
    });

    await test.step("delete comment", async () => {
      const res = await request.delete(`${baseUrl}/${commentId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
    });

    await test.step("verify deleted returns 404", async () => {
      const res = await request.get(`${baseUrl}/${commentId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const fakeSystemId = "sys_00000000-0000-0000-0000-000000000000";
    const fakeSessionId = "fs_00000000-0000-0000-0000-000000000000";
    const res = await request.get(
      `/v1/systems/${fakeSystemId}/fronting-sessions/${fakeSessionId}/comments`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
