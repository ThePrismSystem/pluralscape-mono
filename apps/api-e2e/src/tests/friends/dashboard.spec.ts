import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createBucket, createMember, getSystemId } from "../../fixtures/entity-helpers.js";
import { expect, test } from "../../fixtures/friend.fixture.js";

// ── Constants ────────────────────────────────────────────────────────

/** HTTP 200 OK status code. */
const HTTP_OK = 200;

/** HTTP 201 Created status code. */
const HTTP_CREATED = 201;

/** HTTP 404 Not Found status code. */
const HTTP_NOT_FOUND = 404;

/** Dummy encrypted bucket key for assignment tests. */
const DUMMY_ENCRYPTED_BUCKET_KEY = "dGVzdC1lbmNyeXB0ZWQta2V5";

/** Initial key version for bucket assignments. */
const INITIAL_KEY_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────────

interface DashboardResponse {
  readonly systemId: string;
  readonly memberCount: number;
  readonly activeFronting: {
    readonly sessions: readonly unknown[];
    readonly isCofronting: boolean;
  };
  readonly visibleMembers: readonly { readonly id: string; readonly encryptedData: string }[];
  readonly visibleCustomFronts: readonly unknown[];
  readonly visibleStructureEntities: readonly unknown[];
  readonly keyGrants: readonly {
    readonly id: string;
    readonly bucketId: string;
    readonly encryptedKey: string;
    readonly keyVersion: number;
  }[];
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe("Friend dashboard", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("returns dashboard with bucket-visible data", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    // ── Setup: create system data for Account A ──
    const systemId = await getSystemId(request, accountA.headers);
    const member1 = await createMember(request, accountA.headers, systemId, "Visible Member");
    await createMember(request, accountA.headers, systemId, "Hidden Member");
    const bucket = await createBucket(request, accountA.headers, systemId, "Friend Bucket");

    // Tag member1 with the bucket (member2 stays untagged = invisible)
    await test.step("tag member with bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: accountA.headers,
        data: { entityType: "member", entityId: member1.id },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

    // Assign bucket to the friend connection
    await test.step("assign bucket to friend", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/friends`, {
        headers: accountA.headers,
        data: {
          connectionId: connectionIdA,
          encryptedBucketKey: DUMMY_ENCRYPTED_BUCKET_KEY,
          keyVersion: INITIAL_KEY_VERSION,
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

    // ── Account B calls the dashboard ──
    await test.step("dashboard returns filtered data", async () => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as DashboardResponse;

      // System ID present
      expect(body.systemId).toBe(systemId);

      // memberCount is unfiltered (both members counted)
      expect(body.memberCount).toBe(2);

      // Only the tagged member is visible
      expect(body.visibleMembers).toHaveLength(1);
      expect(body.visibleMembers[0]?.id).toBe(member1.id);
      expect(body.visibleMembers[0]?.encryptedData).toBeTruthy();

      // Key grants present
      expect(body.keyGrants).toHaveLength(1);
      expect(body.keyGrants[0]?.bucketId).toBe(bucket.id);
      expect(body.keyGrants[0]?.keyVersion).toBe(INITIAL_KEY_VERSION);
    });
  });

  test("returns empty filtered arrays with no bucket assignments", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdB },
  }) => {
    const systemId = await getSystemId(request, accountA.headers);
    await createMember(request, accountA.headers, systemId, "Member A");

    const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
      headers: accountB.headers,
    });
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as DashboardResponse;

    // memberCount still populated (unfiltered)
    expect(body.memberCount).toBeGreaterThanOrEqual(1);

    // All filtered arrays are empty
    expect(body.visibleMembers).toEqual([]);
    expect(body.visibleCustomFronts).toEqual([]);
    expect(body.visibleStructureEntities).toEqual([]);
    expect(body.activeFronting.sessions).toEqual([]);
    expect(body.keyGrants).toEqual([]);
  });

  test("returns 404 for non-existent connection", async ({
    request,
    friendAccounts: { accountB },
  }) => {
    const res = await request.get(
      "/v1/account/friends/fc_00000000-0000-0000-0000-000000000000/dashboard",
      { headers: accountB.headers },
    );
    expect(res.status()).toBe(HTTP_NOT_FOUND);
  });

  test("returns 404 for cross-account connection ID", async ({
    request,
    friendAccounts: { accountA, connectionIdB },
  }) => {
    // Account A tries to use Account B's connection ID
    const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
      headers: accountA.headers,
    });
    expect(res.status()).toBe(HTTP_NOT_FOUND);
  });

  test("returns 404 for blocked connection", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    // Account A blocks the connection
    const blockRes = await request.post(`/v1/account/friends/${connectionIdA}/block`, {
      headers: accountA.headers,
    });
    expect(blockRes.ok()).toBe(true);

    // Account B tries to access the dashboard
    const dashRes = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
      headers: accountB.headers,
    });
    expect(dashRes.status()).toBe(HTTP_NOT_FOUND);
  });
});
