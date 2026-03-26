import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi } from "../../fixtures/crypto.fixture.js";
import { createBucket, createMember, getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Bucket CRUD", () => {
  test("create, get, list, update, archive, restore, delete lifecycle", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);

    // ── Create ──
    const bucket = await createBucket(request, authHeaders, systemId, "Privacy Bucket 1");
    const bucketId = bucket.id;
    let version = bucket.version;
    expect(bucketId).toMatch(/^bkt_/);
    expect(version).toBe(1);

    // ── Get ──
    await test.step("get bucket", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucketId}`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { id: string; encryptedData: string; archived: boolean };
      expect(body.id).toBe(bucketId);
      expect(body.encryptedData).toBeTruthy();
      expect(body.archived).toBe(false);
    });

    // ── List ──
    await test.step("list buckets includes created bucket", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { items: { id: string }[] };
      const ids = body.items.map((b) => b.id);
      expect(ids).toContain(bucketId);
    });

    // ── Update ──
    await test.step("update bucket", async () => {
      const res = await request.put(`/v1/systems/${systemId}/buckets/${bucketId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Updated Bucket" }),
          version,
        },
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { version: number };
      expect(body.version).toBe(version + 1);
      version = body.version;
    });

    // ── Archive ──
    await test.step("archive bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("archived bucket not in default list", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { items: { id: string }[] };
      const ids = body.items.map((b) => b.id);
      expect(ids).not.toContain(bucketId);
    });

    await test.step("archived bucket in includeArchived list", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets?includeArchived=true`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { items: { id: string }[] };
      const ids = body.items.map((b) => b.id);
      expect(ids).toContain(bucketId);
    });

    // ── Restore ──
    await test.step("restore bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/restore`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { archived: boolean };
      expect(body.archived).toBe(false);
    });

    // ── Delete ──
    await test.step("delete bucket", async () => {
      const res = await request.delete(`/v1/systems/${systemId}/buckets/${bucketId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted bucket returns 404", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucketId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("create with invalid data returns 400", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.post(`/v1/systems/${systemId}/buckets`, {
      headers: authHeaders,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("get non-existent bucket returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const res = await request.get(
      `/v1/systems/${systemId}/buckets/bkt_00000000-0000-0000-0000-000000000001`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems/sys_00000000-0000-0000-0000-000000000000/buckets", {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });

  test("update with stale version returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "OCC Test Bucket");

    const res = await request.put(`/v1/systems/${systemId}/buckets/${bucket.id}`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ name: "Updated" }),
        version: 999,
      },
    });
    expect(res.status()).toBe(409);
  });

  test("delete bucket with dependents returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Dependents Test");
    const member = await createMember(request, authHeaders, systemId, "Dep Test Member");

    // Tag member in bucket to create a dependent
    const tagRes = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
      headers: authHeaders,
      data: { entityType: "member", entityId: member.id },
    });
    expect(tagRes.status()).toBe(201);

    // Attempt to delete bucket with dependents
    const deleteRes = await request.delete(`/v1/systems/${systemId}/buckets/${bucket.id}`, {
      headers: authHeaders,
    });
    expect(deleteRes.status()).toBe(409);
    const body = (await deleteRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  test("list buckets with pagination", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Create 3 buckets
    await createBucket(request, authHeaders, systemId, "Page Bucket 1");
    await createBucket(request, authHeaders, systemId, "Page Bucket 2");
    await createBucket(request, authHeaders, systemId, "Page Bucket 3");

    // List with limit=2
    const page1Res = await request.get(`/v1/systems/${systemId}/buckets?limit=2`, {
      headers: authHeaders,
    });
    expect(page1Res.ok()).toBe(true);
    const page1 = (await page1Res.json()) as {
      items: { id: string }[];
      nextCursor: string | null;
      hasMore: boolean;
    };
    expect(page1.items.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    // Fetch page 2
    const page2Res = await request.get(
      `/v1/systems/${systemId}/buckets?limit=2&cursor=${String(page1.nextCursor)}`,
      { headers: authHeaders },
    );
    expect(page2Res.ok()).toBe(true);
    const page2 = (await page2Res.json()) as {
      items: { id: string }[];
      hasMore: boolean;
    };
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
  });
});
