import { expect, test } from "../../fixtures/auth.fixture.js";
import { createBucket, createMember, getSystemId } from "../../fixtures/entity-helpers.js";

interface TagEntry {
  entityType: string;
  entityId: string;
  bucketId: string;
}

test.describe("Bucket Content Tags", () => {
  test("tag, list, untag lifecycle", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Tag Test Bucket");
    const member = await createMember(request, authHeaders, systemId, "Tag Test Member");

    // ── Tag content ──
    await test.step("tag member in bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: authHeaders,
        data: { entityType: "member", entityId: member.id },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as TagEntry;
      expect(body.entityType).toBe("member");
      expect(body.entityId).toBe(member.id);
      expect(body.bucketId).toBe(bucket.id);
    });

    // ── List tags ──
    await test.step("list tags by bucket", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: TagEntry[] };
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const tag = body.data.find((t) => t.entityId === member.id);
      expect(tag).toBeTruthy();
      expect(tag?.entityType).toBe("member");
    });

    // ── List with entityType filter ──
    await test.step("list tags filtered by entityType", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/tags?entityType=member`,
        { headers: authHeaders },
      );
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: TagEntry[] };
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    // ── Untag content ──
    await test.step("untag member from bucket", async () => {
      const res = await request.delete(
        `/v1/systems/${systemId}/buckets/${bucket.id}/tags/member/${member.id}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(204);
    });

    // ── Verify tag removed ──
    await test.step("tag no longer in list", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: TagEntry[] };
      const tag = body.data.find((t) => t.entityId === member.id);
      expect(tag).toBeUndefined();
    });
  });

  test("duplicate tag is idempotent", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Dedup Test Bucket");
    const member = await createMember(request, authHeaders, systemId, "Dedup Test Member");

    const tagUrl = `/v1/systems/${systemId}/buckets/${bucket.id}/tags`;
    const tagData = { entityType: "member", entityId: member.id };

    const res1 = await request.post(tagUrl, { headers: authHeaders, data: tagData });
    expect(res1.status()).toBe(201);

    const res2 = await request.post(tagUrl, { headers: authHeaders, data: tagData });
    expect(res2.status()).toBe(201);
  });

  test("invalid entityType returns 400", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId);

    const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
      headers: authHeaders,
      data: { entityType: "invalid", entityId: "some_id" },
    });
    expect(res.status()).toBe(400);
  });

  test("tag content on archived bucket returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Archived Tag Test");

    // Archive the bucket
    const archiveRes = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/archive`, {
      headers: authHeaders,
    });
    expect(archiveRes.status()).toBe(204);

    // Attempt to tag content on the archived bucket
    const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
      headers: authHeaders,
      data: { entityType: "member", entityId: "mem_00000000-0000-0000-0000-000000000001" },
    });
    expect(res.status()).toBe(404);
  });

  test("untag non-existent tag returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId);

    const res = await request.delete(
      `/v1/systems/${systemId}/buckets/${bucket.id}/tags/member/mem_nonexistent`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
