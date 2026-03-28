import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createBucket,
  createCustomFront,
  createGroup,
  createMember,
  getSystemId,
} from "../../fixtures/entity-helpers.js";

// ── Constants ────────────────────────────────────────────────────────

/** HTTP 200 OK. */
const HTTP_OK = 200;

/** HTTP 201 Created. */
const HTTP_CREATED = 201;

/** HTTP 304 Not Modified. */
const HTTP_NOT_MODIFIED = 304;

/** HTTP 400 Bad Request. */
const HTTP_BAD_REQUEST = 400;

/** HTTP 404 Not Found. */
const HTTP_NOT_FOUND = 404;

// ── Types ────────────────────────────────────────────────────────────

interface ManifestEntry {
  readonly entityType: string;
  readonly count: number;
  readonly lastUpdatedAt: number | null;
}

interface ManifestResponse {
  readonly systemId: string;
  readonly bucketId: string;
  readonly entries: readonly ManifestEntry[];
  readonly etag: string;
}

interface ExportEntity {
  readonly id: string;
  readonly entityType: string;
  readonly encryptedData: string;
  readonly updatedAt: number;
}

interface ExportPageResponse {
  readonly items: readonly ExportEntity[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount: number | null;
  readonly etag: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Tag an entity with a bucket. */
async function tagEntityWithBucket(
  request: import("@playwright/test").APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  bucketId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/tags`, {
    headers,
    data: { entityType, entityId },
  });
  expect(res.status()).toBe(HTTP_CREATED);
}

/** Archive a bucket. */
async function archiveBucket(
  request: import("@playwright/test").APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  bucketId: string,
): Promise<void> {
  const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/archive`, {
    headers,
  });
  expect(res.ok()).toBe(true);
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe("Bucket export", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  // ── Manifest ─────────────────────────────────────────────────────

  test.describe("Manifest", () => {
    test("empty bucket returns zero counts for all entity types", async ({
      request,
      authHeaders,
    }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Empty Manifest");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ManifestResponse;

      expect(body.systemId).toBe(systemId);
      expect(body.bucketId).toBe(bucket.id);
      expect(body.entries.length).toBeGreaterThan(0);

      for (const entry of body.entries) {
        expect(entry.count).toBe(0);
        expect(entry.lastUpdatedAt).toBeNull();
      }
    });

    test("bucket with tagged members returns correct count", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Manifest Bucket");
      const member = await createMember(request, authHeaders, systemId, "Manifest M1");

      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", member.id);

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ManifestResponse;

      const memberEntry = body.entries.find((e) => e.entityType === "member");
      expect(memberEntry).toBeDefined();
      expect(memberEntry?.count).toBe(1);
      expect(memberEntry?.lastUpdatedAt).toBeGreaterThan(0);
    });

    test("returns manifest entries for all 21 entity types", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "21 Types Bucket");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ManifestResponse;

      // 21 bucket content entity types
      expect(body.entries).toHaveLength(21);
    });

    test("returns ETag header", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "ETag Bucket");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      expect(res.headers()["etag"]).toBeTruthy();
    });

    test("returns 304 when ETag matches (If-None-Match)", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "304 Bucket");

      const firstRes = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: authHeaders },
      );
      expect(firstRes.status()).toBe(HTTP_OK);
      const etag = firstRes.headers()["etag"] ?? "";

      const secondRes = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: { ...authHeaders, "If-None-Match": etag } },
      );
      expect(secondRes.status()).toBe(HTTP_NOT_MODIFIED);
    });

    test("returns 404 for non-owner (second registered account)", async ({ request }) => {
      // Register two accounts
      const reg1 = await request.post("/v1/auth/register", {
        data: {
          email: `e2e-owner-${crypto.randomUUID()}@test.pluralscape.local`,
          password: `E2E-TestPass-${crypto.randomUUID()}`,
          recoveryKeyBackupConfirmed: true,
        },
      });
      const { sessionToken: token1 } = (await reg1.json()) as { sessionToken: string };
      const headers1 = { Authorization: `Bearer ${token1}` };

      const reg2 = await request.post("/v1/auth/register", {
        data: {
          email: `e2e-other-${crypto.randomUUID()}@test.pluralscape.local`,
          password: `E2E-TestPass-${crypto.randomUUID()}`,
          recoveryKeyBackupConfirmed: true,
        },
      });
      const { sessionToken: token2 } = (await reg2.json()) as { sessionToken: string };
      const headers2 = { Authorization: `Bearer ${token2}` };

      const systemId = await getSystemId(request, headers1);
      const bucket = await createBucket(request, headers1, systemId, "Non-Owner Bucket");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export/manifest`,
        { headers: headers2 },
      );
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });
  });

  // ── Paginated export ─────────────────────────────────────────────

  test.describe("Paginated export", () => {
    test("export bucket with mixed entity types", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Mixed Export");
      const member = await createMember(request, authHeaders, systemId, "Mix M1");
      const group = await createGroup(request, authHeaders, systemId, { name: "Mix G1" });
      const customFront = await createCustomFront(request, authHeaders, systemId, "Mix CF1");

      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", member.id);
      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "group", group.id);
      await tagEntityWithBucket(
        request,
        authHeaders,
        systemId,
        bucket.id,
        "custom-front",
        customFront.id,
      );

      // Export each type
      for (const entityType of ["member", "group", "custom-front"]) {
        const res = await request.get(
          `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=${entityType}`,
          { headers: authHeaders },
        );
        expect(res.status()).toBe(HTTP_OK);
        const body = (await res.json()) as ExportPageResponse;
        expect(body.items).toHaveLength(1);
        expect(body.items[0]?.entityType).toBe(entityType);
      }
    });

    test("pagination traversal: limit=2 with 3 members", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Page Bucket");

      for (let i = 0; i < 3; i++) {
        const m = await createMember(request, authHeaders, systemId, `Page M${String(i)}`);
        await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", m.id);
      }

      const page1Res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member&limit=2`,
        { headers: authHeaders },
      );
      expect(page1Res.status()).toBe(HTTP_OK);
      const page1 = (await page1Res.json()) as ExportPageResponse;
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      const page2Res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member&limit=2&cursor=${String(page1.nextCursor)}`,
        { headers: authHeaders },
      );
      expect(page2Res.status()).toBe(HTTP_OK);
      const page2 = (await page2Res.json()) as ExportPageResponse;
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    test("empty bucket returns empty result", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Empty Export");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ExportPageResponse;
      expect(body.items).toHaveLength(0);
      expect(body.hasMore).toBe(false);
      expect(body.nextCursor).toBeNull();
    });

    test("non-owner receives 404", async ({ request }) => {
      const reg1 = await request.post("/v1/auth/register", {
        data: {
          email: `e2e-own-${crypto.randomUUID()}@test.pluralscape.local`,
          password: `E2E-TestPass-${crypto.randomUUID()}`,
          recoveryKeyBackupConfirmed: true,
        },
      });
      const { sessionToken: t1 } = (await reg1.json()) as { sessionToken: string };
      const h1 = { Authorization: `Bearer ${t1}` };

      const reg2 = await request.post("/v1/auth/register", {
        data: {
          email: `e2e-oth-${crypto.randomUUID()}@test.pluralscape.local`,
          password: `E2E-TestPass-${crypto.randomUUID()}`,
          recoveryKeyBackupConfirmed: true,
        },
      });
      const { sessionToken: t2 } = (await reg2.json()) as { sessionToken: string };
      const h2 = { Authorization: `Bearer ${t2}` };

      const sysId = await getSystemId(request, h1);
      const bucket = await createBucket(request, h1, sysId, "Non-Owner Export");

      const res = await request.get(
        `/v1/systems/${sysId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: h2 },
      );
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });

    test("archived bucket export returns 404", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Archived Export");

      await archiveBucket(request, authHeaders, systemId, bucket.id);

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });

    test("exported entities match tagged content exactly", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Match Bucket");
      const m1 = await createMember(request, authHeaders, systemId, "Match M1");
      const m2 = await createMember(request, authHeaders, systemId, "Match M2");
      await createMember(request, authHeaders, systemId, "Match M3 Untagged");

      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", m1.id);
      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", m2.id);

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ExportPageResponse;
      expect(body.items).toHaveLength(2);

      const ids = body.items.map((i) => i.id).sort();
      expect(ids).toEqual([m1.id, m2.id].sort());
    });

    test("returns 400 for missing entityType", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Missing Type");

      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucket.id}/export`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_BAD_REQUEST);
    });

    test("returns 400 for invalid entityType", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Invalid Type");

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=bogus`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_BAD_REQUEST);
    });

    test("returns ETag header on paginated export", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Page ETag");
      const member = await createMember(request, authHeaders, systemId, "Page ETag M1");
      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", member.id);

      const res = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(HTTP_OK);
      expect(res.headers()["etag"]).toBeTruthy();
    });

    test("returns 304 when If-None-Match matches on paginated export", async ({
      request,
      authHeaders,
    }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Page 304");
      const member = await createMember(request, authHeaders, systemId, "Page 304 M1");
      await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", member.id);

      const firstRes = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: authHeaders },
      );
      expect(firstRes.status()).toBe(HTTP_OK);
      const etag = firstRes.headers()["etag"] ?? "";

      const secondRes = await request.get(
        `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member`,
        { headers: { ...authHeaders, "If-None-Match": etag } },
      );
      expect(secondRes.status()).toBe(HTTP_NOT_MODIFIED);
    });

    test("full pagination traversal collects all entities", async ({ request, authHeaders }) => {
      const systemId = await getSystemId(request, authHeaders);
      const bucket = await createBucket(request, authHeaders, systemId, "Full Page Bucket");

      const memberIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const m = await createMember(request, authHeaders, systemId, `Full M${String(i)}`);
        await tagEntityWithBucket(request, authHeaders, systemId, bucket.id, "member", m.id);
        memberIds.push(m.id);
      }

      const collected: string[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const url = cursor
          ? `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member&limit=2&cursor=${cursor}`
          : `/v1/systems/${systemId}/buckets/${bucket.id}/export?entityType=member&limit=2`;
        const res = await request.get(url, { headers: authHeaders });
        expect(res.status()).toBe(HTTP_OK);
        const body = (await res.json()) as ExportPageResponse;
        collected.push(...body.items.map((i) => i.id));
        cursor = body.nextCursor;
        pageCount++;
      } while (cursor !== null && pageCount < 10);

      expect(collected.sort()).toEqual(memberIds.sort());
    });
  });
});
