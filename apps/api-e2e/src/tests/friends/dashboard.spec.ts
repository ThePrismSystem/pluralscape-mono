import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createBucket,
  createCustomFront,
  createFrontingSession,
  createMember,
  getSystemId,
} from "../../fixtures/entity-helpers.js";
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

interface FrontingSessionEntry {
  readonly id: string;
  readonly memberId: string;
}

interface DashboardResponse {
  readonly systemId: string;
  readonly memberCount: number;
  readonly activeFronting: {
    readonly sessions: readonly FrontingSessionEntry[];
    readonly isCofronting: boolean;
  };
  readonly visibleMembers: readonly { readonly id: string; readonly encryptedData: string }[];
  readonly visibleCustomFronts: readonly { readonly id: string }[];
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
      const body = (await res.json()) as { data: DashboardResponse };

      // System ID present
      expect(body.data.systemId).toBe(systemId);

      // memberCount is now bucket-filtered (only the tagged member counted)
      expect(body.data.memberCount).toBe(1);

      // Only the tagged member is visible
      expect(body.data.visibleMembers).toHaveLength(1);
      expect(body.data.visibleMembers[0]?.id).toBe(member1.id);
      expect(typeof body.data.visibleMembers[0]?.encryptedData).toBe("string");
      expect(body.data.visibleMembers[0]?.encryptedData.length).toBeGreaterThan(0);

      // Key grants present
      expect(body.data.keyGrants).toHaveLength(1);
      expect(body.data.keyGrants[0]?.bucketId).toBe(bucket.id);
      expect(body.data.keyGrants[0]?.keyVersion).toBe(INITIAL_KEY_VERSION);
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
    const body = (await res.json()) as { data: DashboardResponse };

    // memberCount is bucket-filtered (no visible members with no buckets assigned)
    expect(body.data.memberCount).toBe(0);

    // All filtered arrays are empty
    expect(body.data.visibleMembers).toEqual([]);
    expect(body.data.visibleCustomFronts).toEqual([]);
    expect(body.data.visibleStructureEntities).toEqual([]);
    expect(body.data.activeFronting.sessions).toEqual([]);
    expect(body.data.keyGrants).toEqual([]);
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

  test("returns active fronting sessions visible via member bucket tags", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    const systemId = await getSystemId(request, accountA.headers);
    const member = await createMember(request, accountA.headers, systemId, "Fronting Member");
    const bucket = await createBucket(request, accountA.headers, systemId, "Session Bucket");

    // Tag member with bucket
    await test.step("tag member with bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: accountA.headers,
        data: { entityType: "member", entityId: member.id },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

    // Assign bucket to friend
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

    // Start fronting session
    await createFrontingSession(request, accountA.headers, systemId, member.id);

    // Dashboard should show the session
    await test.step("dashboard returns active fronting session", async () => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: DashboardResponse };

      expect(body.data.activeFronting.sessions).toHaveLength(1);
      expect(body.data.activeFronting.sessions[0]?.memberId).toBe(member.id);
      expect(body.data.activeFronting.isCofronting).toBe(false);
    });
  });

  test("returns custom fronts visible via bucket tags", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    const systemId = await getSystemId(request, accountA.headers);
    const customFront = await createCustomFront(request, accountA.headers, systemId, "Test Front");
    const bucket = await createBucket(request, accountA.headers, systemId, "CF Bucket");

    await test.step("tag custom front with bucket", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: accountA.headers,
        data: { entityType: "custom-front", entityId: customFront.id },
      });
      expect(res.status()).toBe(HTTP_CREATED);
    });

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

    await test.step("dashboard returns visible custom front", async () => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: DashboardResponse };

      expect(body.data.visibleCustomFronts).toHaveLength(1);
      expect(body.data.visibleCustomFronts[0]?.id).toBe(customFront.id);
    });
  });

  test("detects co-fronting with multiple active sessions", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    const systemId = await getSystemId(request, accountA.headers);
    const memberA = await createMember(request, accountA.headers, systemId, "Co-Front Member A");
    const memberB = await createMember(request, accountA.headers, systemId, "Co-Front Member B");
    const bucket = await createBucket(request, accountA.headers, systemId, "Co-Front Bucket");

    // Tag both members with the bucket
    await test.step("tag members with bucket", async () => {
      const resA = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: accountA.headers,
        data: { entityType: "member", entityId: memberA.id },
      });
      expect(resA.status()).toBe(HTTP_CREATED);

      const resB = await request.post(`/v1/systems/${systemId}/buckets/${bucket.id}/tags`, {
        headers: accountA.headers,
        data: { entityType: "member", entityId: memberB.id },
      });
      expect(resB.status()).toBe(HTTP_CREATED);
    });

    // Assign bucket to friend
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

    // Start two fronting sessions (co-fronting)
    await createFrontingSession(request, accountA.headers, systemId, memberA.id);
    await createFrontingSession(request, accountA.headers, systemId, memberB.id);

    // Dashboard should detect co-fronting
    await test.step("dashboard returns co-fronting state", async () => {
      const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard`, {
        headers: accountB.headers,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as { data: DashboardResponse };

      expect(body.data.activeFronting.sessions).toHaveLength(2);
      expect(body.data.activeFronting.isCofronting).toBe(true);
    });
  });

  test("dashboard sync endpoint returns data", async ({
    request,
    friendAccounts: { accountB, connectionIdB },
  }) => {
    const res = await request.get(`/v1/account/friends/${connectionIdB}/dashboard/sync`, {
      headers: accountB.headers,
    });
    expect(res.status()).toBe(HTTP_OK);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });
});
