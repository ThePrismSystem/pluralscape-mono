import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

interface AcknowledgementResponse {
  id: string;
  systemId: string;
  createdByMemberId: string | null;
  confirmed: boolean;
  encryptedData: string;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface AcknowledgementListResponse {
  items: AcknowledgementResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

const ACK_DATA = {
  message: "Please acknowledge this",
  targetMemberId: "mem_00000000-0000-0000-0000-000000000001",
};
const UPDATED_ACK_DATA = {
  message: "Updated acknowledgement",
  targetMemberId: "mem_00000000-0000-0000-0000-000000000001",
  confirmedAt: Date.now(),
};

test.describe("Acknowledgements CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("acknowledgement lifecycle: create, get, list, confirm, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const acksUrl = `/v1/systems/${systemId}/acknowledgements`;
    let ackId: string;

    await test.step("create acknowledgement", async () => {
      const res = await request.post(acksUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(ACK_DATA),
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as AcknowledgementResponse;
      expect(body.id).toMatch(/^ack_/);
      expect(body.confirmed).toBe(false);
      expect(body.version).toBe(1);
      expect(body.archived).toBe(false);
      ackId = body.id;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${acksUrl}/${ackId}`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementResponse;
      expect(body.id).toBe(ackId);
      const decrypted = decryptFromApi(body.encryptedData);
      expect(decrypted).toEqual(ACK_DATA);
    });

    await test.step("list includes created acknowledgement", async () => {
      const res = await request.get(acksUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("hasMore");
      expect(body.items.some((item: AcknowledgementResponse) => item.id === ackId)).toBe(true);
    });

    await test.step("list pending (confirmed=false)", async () => {
      const res = await request.get(`${acksUrl}?confirmed=false`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body.items.some((item: AcknowledgementResponse) => item.id === ackId)).toBe(true);
    });

    await test.step("confirm acknowledgement", async () => {
      const res = await request.post(`${acksUrl}/${ackId}/confirm`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_ACK_DATA),
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementResponse;
      expect(body.confirmed).toBe(true);
      expect(body.version).toBe(2);
    });

    await test.step("confirm again is idempotent", async () => {
      const res = await request.post(`${acksUrl}/${ackId}/confirm`, {
        headers: authHeaders,
        data: {},
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementResponse;
      expect(body.confirmed).toBe(true);
      // Version should NOT change on idempotent re-confirm
      expect(body.version).toBe(2);
    });

    await test.step("list confirmed (confirmed=true)", async () => {
      const res = await request.get(`${acksUrl}?confirmed=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body.items.some((item: AcknowledgementResponse) => item.id === ackId)).toBe(true);
    });

    await test.step("not in pending list after confirm", async () => {
      const res = await request.get(`${acksUrl}?confirmed=false`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body.items.every((item: AcknowledgementResponse) => item.id !== ackId)).toBe(true);
    });

    await test.step("archive acknowledgement", async () => {
      const res = await request.post(`${acksUrl}/${ackId}/archive`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("archived not in default list", async () => {
      const res = await request.get(acksUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body.items.every((item: AcknowledgementResponse) => item.id !== ackId)).toBe(true);
    });

    await test.step("archived in list with includeArchived=true", async () => {
      const res = await request.get(`${acksUrl}?includeArchived=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementListResponse;
      expect(body.items.some((item: AcknowledgementResponse) => item.id === ackId)).toBe(true);
    });

    await test.step("restore acknowledgement", async () => {
      const res = await request.post(`${acksUrl}/${ackId}/restore`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as AcknowledgementResponse;
      expect(body.archived).toBe(false);
    });

    await test.step("delete acknowledgement", async () => {
      const res = await request.delete(`${acksUrl}/${ackId}`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted acknowledgement returns 404", async () => {
      const res = await request.get(`${acksUrl}/${ackId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(
      "/v1/systems/sys_00000000-0000-0000-0000-000000000000/acknowledgements",
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
