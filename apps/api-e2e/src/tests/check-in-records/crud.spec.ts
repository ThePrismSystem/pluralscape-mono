import {
  assertIdorRejected,
  assertPaginates,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createCheckInRecord,
  createMember,
  createTimerConfig,
  getSystemId,
} from "../../fixtures/entity-helpers.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

test.describe("Check-in records CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("check-in lifecycle: create, get, list, respond, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const timerConfig = await createTimerConfig(request, authHeaders, systemId);
    const member = await createMember(request, authHeaders, systemId, "Responder");
    const recordsUrl = `/v1/systems/${systemId}/check-in-records`;
    let recordId: string;

    await test.step("create check-in record", async () => {
      const res = await request.post(recordsUrl, {
        headers: authHeaders,
        data: {
          timerConfigId: timerConfig.id,
          scheduledAt: Date.now(),
          encryptedData: encryptForApi({ note: "Check-in test" }),
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string } };
      recordId = body.data.id;
    });

    await test.step("get check-in record", async () => {
      const res = await request.get(`${recordsUrl}/${recordId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("list includes record", async () => {
      const res = await request.get(recordsUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((r) => r.id)).toContain(recordId);
    });

    await test.step("respond to check-in", async () => {
      const res = await request.post(`${recordsUrl}/${recordId}/respond`, {
        headers: authHeaders,
        data: { respondedByMemberId: member.id },
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("archive record", async () => {
      const res = await request.post(`${recordsUrl}/${recordId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("restore record", async () => {
      const res = await request.post(`${recordsUrl}/${recordId}/restore`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
    });

    await test.step("delete record", async () => {
      const res = await request.delete(`${recordsUrl}/${recordId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/check-in-records`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/check-in-records`,
      secondAuthHeaders,
    );
  });

  test("list paginates", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const timerConfig = await createTimerConfig(request, authHeaders, systemId);
    await assertPaginates(
      request,
      `/v1/systems/${systemId}/check-in-records`,
      authHeaders,
      async () => {
        await createCheckInRecord(request, authHeaders, systemId, timerConfig.id);
      },
    );
  });
});
