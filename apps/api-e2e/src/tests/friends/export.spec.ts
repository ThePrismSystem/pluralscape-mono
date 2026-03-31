import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createBucket,
  createCustomFront,
  createGroup,
  createMember,
  getSystemId,
} from "../../fixtures/entity-helpers.js";
import { expect, test } from "../../fixtures/friend.fixture.js";
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_NOT_FOUND,
  HTTP_NOT_MODIFIED,
  HTTP_OK,
} from "../../fixtures/http.constants.js";

/** Dummy encrypted bucket key for assignment tests. */
const DUMMY_ENCRYPTED_BUCKET_KEY = "dGVzdC1lbmNyeXB0ZWQta2V5";

/** Initial key version for bucket assignments. */
const INITIAL_KEY_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────────

interface ManifestEntry {
  readonly entityType: string;
  readonly count: number;
  readonly lastUpdatedAt: number | null;
}

interface ManifestResponse {
  readonly systemId: string;
  readonly entries: readonly ManifestEntry[];
  readonly keyGrants: readonly { readonly id: string; readonly bucketId: string }[];
  readonly etag: string;
}

interface ExportEntity {
  readonly id: string;
  readonly entityType: string;
  readonly encryptedData: string;
  readonly updatedAt: number;
}

interface ExportPageResponse {
  readonly data: readonly ExportEntity[];
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

/** Assign a bucket to a friend connection. */
async function assignBucketToFriend(
  request: import("@playwright/test").APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  bucketId: string,
  connectionId: string,
): Promise<void> {
  const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/friends`, {
    headers,
    data: {
      connectionId,
      encryptedBucketKey: DUMMY_ENCRYPTED_BUCKET_KEY,
      keyVersion: INITIAL_KEY_VERSION,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe("Friend data export", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  // ── Manifest ─────────────────────────────────────────────────────

  test.describe("Manifest", () => {
    test("returns manifest with zero counts when no bucket assignments", async ({
      request,
      friendAccounts: { accountB, connectionIdB },
    }) => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/export/manifest`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: ManifestResponse };

      expect(body.data.systemId).toBeTruthy();
      expect(body.data.entries.length).toBeGreaterThan(0);
      expect(body.data.etag).toBeTruthy();

      // All counts should be 0 with no bucket assignments
      for (const entry of body.data.entries) {
        expect(entry.count).toBe(0);
        expect(entry.lastUpdatedAt).toBeNull();
      }
    });

    test("returns correct count for bucket-visible members", async ({
      request,
      friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
    }) => {
      const systemId = await getSystemId(request, accountA.headers);
      const member1 = await createMember(request, accountA.headers, systemId, "Export M1");
      await createMember(request, accountA.headers, systemId, "Export M2 Hidden");
      const bucket = await createBucket(request, accountA.headers, systemId, "Export Bucket");

      await tagEntityWithBucket(
        request,
        accountA.headers,
        systemId,
        bucket.id,
        "member",
        member1.id,
      );
      await assignBucketToFriend(request, accountA.headers, systemId, bucket.id, connectionIdA);

      const res = await request.get(`/v1/account/friends/${connectionIdB}/export/manifest`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: ManifestResponse };

      const memberEntry = body.data.entries.find((e) => e.entityType === "member");
      expect(memberEntry).toBeDefined();
      expect(memberEntry?.count).toBe(1);
      expect(memberEntry?.lastUpdatedAt).toBeGreaterThan(0);

      // Key grants present
      expect(body.data.keyGrants).toHaveLength(1);
      expect(body.data.keyGrants[0]?.bucketId).toBe(bucket.id);
    });

    test("returns 304 when ETag matches", async ({
      request,
      friendAccounts: { accountB, connectionIdB },
    }) => {
      const firstRes = await request.get(`/v1/account/friends/${connectionIdB}/export/manifest`, {
        headers: accountB.headers,
      });
      expect(firstRes.status()).toBe(HTTP_OK);
      const etag = firstRes.headers()["etag"] ?? "";
      expect(etag).toBeTruthy();

      const secondRes = await request.get(`/v1/account/friends/${connectionIdB}/export/manifest`, {
        headers: { ...accountB.headers, "If-None-Match": etag },
      });
      expect(secondRes.status()).toBe(HTTP_NOT_MODIFIED);
    });

    test("returns 404 for non-existent connection", async ({
      request,
      friendAccounts: { accountB },
    }) => {
      const res = await request.get(
        "/v1/account/friends/fc_00000000-0000-0000-0000-000000000000/export/manifest",
        { headers: accountB.headers },
      );
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });

    test("returns 404 for cross-account connection ID", async ({
      request,
      friendAccounts: { accountA, connectionIdB },
    }) => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/export/manifest`, {
        headers: accountA.headers,
      });
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });
  });

  // ── Paginated export ─────────────────────────────────────────────

  test.describe("Paginated export", () => {
    test("returns bucket-visible members only", async ({
      request,
      friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
    }) => {
      const systemId = await getSystemId(request, accountA.headers);
      const visible = await createMember(request, accountA.headers, systemId, "Visible");
      await createMember(request, accountA.headers, systemId, "Hidden");
      const bucket = await createBucket(request, accountA.headers, systemId, "Vis Bucket");

      await tagEntityWithBucket(
        request,
        accountA.headers,
        systemId,
        bucket.id,
        "member",
        visible.id,
      );
      await assignBucketToFriend(request, accountA.headers, systemId, bucket.id, connectionIdA);

      const res = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member`,
        { headers: accountB.headers },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as ExportPageResponse;

      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.id).toBe(visible.id);
      expect(body.data[0]?.entityType).toBe("member");
      expect(body.data[0]?.encryptedData).toBeTruthy();
      expect(body.data[0]?.updatedAt).toBeGreaterThan(0);
      expect(body.etag).toBeTruthy();
    });

    test("paginates with cursor", async ({
      request,
      friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
    }) => {
      const systemId = await getSystemId(request, accountA.headers);
      const bucket = await createBucket(request, accountA.headers, systemId, "Page Bucket");

      // Create 3 members, tag all
      const memberIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const m = await createMember(request, accountA.headers, systemId, `Page M${String(i)}`);
        await tagEntityWithBucket(request, accountA.headers, systemId, bucket.id, "member", m.id);
        memberIds.push(m.id);
      }

      await assignBucketToFriend(request, accountA.headers, systemId, bucket.id, connectionIdA);

      // First page: limit=2
      const page1Res = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member&limit=2`,
        { headers: accountB.headers },
      );
      expect(page1Res.status()).toBe(HTTP_OK);
      const page1 = (await page1Res.json()) as ExportPageResponse;

      expect(page1.data.length).toBeGreaterThanOrEqual(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      // Second page: follow cursor
      const cursor = page1.nextCursor ?? "";
      const page2Res = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member&limit=2&cursor=${cursor}`,
        { headers: accountB.headers },
      );
      expect(page2Res.status()).toBe(HTTP_OK);
      const page2 = (await page2Res.json()) as ExportPageResponse;

      // Collect all IDs across pages
      const allIds = [...page1.data.map((i) => i.id), ...page2.data.map((i) => i.id)];
      // All 3 created members should appear across both pages
      for (const id of memberIds) {
        expect(allIds).toContain(id);
      }
    });

    test("exports different entity types", async ({
      request,
      friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
    }) => {
      const systemId = await getSystemId(request, accountA.headers);
      const bucket = await createBucket(request, accountA.headers, systemId, "Multi Bucket");

      const member = await createMember(request, accountA.headers, systemId, "Multi M");
      const group = await createGroup(request, accountA.headers, systemId, { name: "Multi G" });
      const cf = await createCustomFront(request, accountA.headers, systemId, "Multi CF");

      await tagEntityWithBucket(
        request,
        accountA.headers,
        systemId,
        bucket.id,
        "member",
        member.id,
      );
      await tagEntityWithBucket(request, accountA.headers, systemId, bucket.id, "group", group.id);
      await tagEntityWithBucket(
        request,
        accountA.headers,
        systemId,
        bucket.id,
        "custom-front",
        cf.id,
      );
      await assignBucketToFriend(request, accountA.headers, systemId, bucket.id, connectionIdA);

      // Export members
      const memberRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member`,
        { headers: accountB.headers },
      );
      const memberBody = (await memberRes.json()) as ExportPageResponse;
      expect(memberBody.data).toHaveLength(1);
      expect(memberBody.data[0]?.entityType).toBe("member");

      // Export groups
      const groupRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=group`,
        { headers: accountB.headers },
      );
      const groupBody = (await groupRes.json()) as ExportPageResponse;
      expect(groupBody.data).toHaveLength(1);
      expect(groupBody.data[0]?.entityType).toBe("group");

      // Export custom fronts
      const cfRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=custom-front`,
        { headers: accountB.headers },
      );
      const cfBody = (await cfRes.json()) as ExportPageResponse;
      expect(cfBody.data).toHaveLength(1);
      expect(cfBody.data[0]?.entityType).toBe("custom-front");
    });

    test("returns 304 when ETag matches", async ({
      request,
      friendAccounts: { accountB, connectionIdB },
    }) => {
      const firstRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member`,
        { headers: accountB.headers },
      );
      expect(firstRes.status()).toBe(HTTP_OK);
      const etag = firstRes.headers()["etag"] ?? "";
      expect(etag).toBeTruthy();

      const secondRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member`,
        { headers: { ...accountB.headers, "If-None-Match": etag } },
      );
      expect(secondRes.status()).toBe(HTTP_NOT_MODIFIED);
    });

    test("returns 400 for invalid entityType", async ({
      request,
      friendAccounts: { accountB, connectionIdB },
    }) => {
      const res = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=invalid`,
        { headers: accountB.headers },
      );
      expect(res.status()).toBe(HTTP_BAD_REQUEST);
    });

    test("returns 400 for missing entityType", async ({
      request,
      friendAccounts: { accountB, connectionIdB },
    }) => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/export`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_BAD_REQUEST);
    });

    test("returns 404 for non-existent connection", async ({
      request,
      friendAccounts: { accountB },
    }) => {
      const res = await request.get(
        "/v1/account/friends/fc_00000000-0000-0000-0000-000000000000/export?entityType=member",
        { headers: accountB.headers },
      );
      expect(res.status()).toBe(HTTP_NOT_FOUND);
    });

    test("returns 404 for blocked connection", async ({
      request,
      friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
    }) => {
      // Block the connection
      const blockRes = await request.post(`/v1/account/friends/${connectionIdA}/block`, {
        headers: accountA.headers,
      });
      expect(blockRes.ok()).toBe(true);

      // Try export
      const exportRes = await request.get(
        `/v1/account/friends/${connectionIdB}/export?entityType=member`,
        { headers: accountB.headers },
      );
      expect(exportRes.status()).toBe(HTTP_NOT_FOUND);
    });
  });
});
