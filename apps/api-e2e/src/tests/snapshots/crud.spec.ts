import {
  assertIdorRejected,
  assertPaginates,
  assertRequiresAuth,
} from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createSnapshot, getSystemId } from "../../fixtures/entity-helpers.js";
import {
  HTTP_CREATED,
  HTTP_NOT_FOUND,
  HTTP_NO_CONTENT,
  HTTP_OK,
} from "../../fixtures/http.constants.js";

test.describe("System snapshots CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("snapshot lifecycle: create, get, list, delete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const url = `/v1/systems/${systemId}/snapshots`;
    let snapshotId: string;

    await test.step("create manual snapshot", async () => {
      const res = await request.post(url, {
        headers: authHeaders,
        data: {
          snapshotTrigger: "manual",
          encryptedData: encryptForApi({ note: "Test snapshot" }),
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: { id: string; snapshotTrigger: string } };
      snapshotId = body.data.id;
      expect(body.data.snapshotTrigger).toBe("manual");
    });

    await test.step("get snapshot by ID", async () => {
      const res = await request.get(`${url}/${snapshotId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: { id: string } };
      expect(body.data.id).toBe(snapshotId);
    });

    await test.step("list includes snapshot", async () => {
      const res = await request.get(url, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((s) => s.id)).toContain(snapshotId);
    });

    await test.step("delete snapshot", async () => {
      const res = await request.delete(`${url}/${snapshotId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("get deleted snapshot returns 404", async () => {
      const res = await request.get(`${url}/${snapshotId}`, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });
  });

  test("supports different trigger types", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    for (const trigger of ["manual", "scheduled-daily", "scheduled-weekly"] as const) {
      const res = await request.post(`/v1/systems/${systemId}/snapshots`, {
        headers: authHeaders,
        data: {
          snapshotTrigger: trigger,
          encryptedData: encryptForApi({ note: `${trigger} snapshot` }),
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    }
  });

  test("requires auth", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertRequiresAuth(request, "GET", `/v1/systems/${systemId}/snapshots`);
  });

  test("rejects cross-account access", async ({ request, authHeaders, secondAuthHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertIdorRejected(
      request,
      "GET",
      `/v1/systems/${systemId}/snapshots`,
      secondAuthHeaders,
    );
  });

  test("list paginates", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await assertPaginates(request, `/v1/systems/${systemId}/snapshots`, authHeaders, async () => {
      await createSnapshot(request, authHeaders, systemId);
    });
  });
});
