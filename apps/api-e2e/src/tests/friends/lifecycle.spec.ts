import crypto from "node:crypto";

import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createBucket, getSystemId } from "../../fixtures/entity-helpers.js";
import { expect, test } from "../../fixtures/friend.fixture.js";
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK } from "../../fixtures/http.constants.js";

/** Dummy encrypted bucket key for assignment tests. */
const DUMMY_ENCRYPTED_BUCKET_KEY = "dGVzdC1lbmNyeXB0ZWQta2V5";

/** Initial key version for bucket assignments. */
const INITIAL_KEY_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────────

interface FriendConnectionResponse {
  readonly id: string;
  readonly accountId: string;
  readonly friendAccountId: string;
  readonly status: string;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface FriendConnectionListResponse {
  readonly data: readonly FriendConnectionResponse[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

interface BucketAssignmentResponse {
  readonly friendConnectionId: string;
  readonly bucketId: string;
  readonly friendAccountId: string;
}

interface BucketAssignmentListResponse {
  readonly data: readonly BucketAssignmentResponse[];
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe("Friend lifecycle", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("list connections after establishing friendship", async ({
    request,
    friendAccounts: { accountA, accountB, connectionIdA, connectionIdB },
  }) => {
    // Account A lists their connections
    const listA = await request.get("/v1/account/friends", {
      headers: accountA.headers,
    });
    expect(listA.ok()).toBe(true);
    const bodyA = (await listA.json()) as FriendConnectionListResponse;
    const connA = bodyA.data.find((c) => c.id === connectionIdA);
    expect(connA).toBeTruthy();
    expect(connA?.status).toBe("accepted");
    expect(connA?.friendAccountId).toBe(accountB.accountId);

    // Account B lists their connections
    const listB = await request.get("/v1/account/friends", {
      headers: accountB.headers,
    });
    expect(listB.ok()).toBe(true);
    const bodyB = (await listB.json()) as FriendConnectionListResponse;
    const connB = bodyB.data.find((c) => c.id === connectionIdB);
    expect(connB).toBeTruthy();
    expect(connB?.status).toBe("accepted");
    expect(connB?.friendAccountId).toBe(accountA.accountId);
  });

  test("get individual connection", async ({
    request,
    friendAccounts: { accountA, connectionIdA },
  }) => {
    const res = await request.get(`/v1/account/friends/${connectionIdA}`, {
      headers: accountA.headers,
    });
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as { data: FriendConnectionResponse };
    expect(body.data.id).toBe(connectionIdA);
    expect(body.data.status).toBe("accepted");
    expect(body.data.version).toBeGreaterThanOrEqual(1);
  });

  test("bucket assignment: assign, list, unassign", async ({
    request,
    friendAccounts: { accountA, connectionIdA },
  }) => {
    const systemId = await getSystemId(request, accountA.headers);
    const bucket = await createBucket(request, accountA.headers, systemId, "Friend Bucket");
    const bucketId = bucket.id;

    // ── Assign bucket to friend connection ──
    await test.step("assign bucket to friend", async () => {
      const res = await request.post(`/v1/systems/${systemId}/buckets/${bucketId}/friends`, {
        headers: accountA.headers,
        data: {
          connectionId: connectionIdA,
          encryptedBucketKey: DUMMY_ENCRYPTED_BUCKET_KEY,
          keyVersion: INITIAL_KEY_VERSION,
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = (await res.json()) as { data: BucketAssignmentResponse };
      expect(body.data.friendConnectionId).toBe(connectionIdA);
      expect(body.data.bucketId).toBe(bucketId);
      expect(body.data.friendAccountId).toBeTruthy();
    });

    // ── List bucket assignments ──
    await test.step("list bucket assignments includes the friend", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucketId}/friends`, {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as BucketAssignmentListResponse;
      const connectionIds = body.data.map((a) => a.friendConnectionId);
      expect(connectionIds).toContain(connectionIdA);
    });

    // ── Unassign bucket from friend ──
    await test.step("unassign bucket from friend", async () => {
      const res = await request.delete(
        `/v1/systems/${systemId}/buckets/${bucketId}/friends/${connectionIdA}`,
        { headers: accountA.headers },
      );
      expect(res.status()).toBe(HTTP_OK);
      const body = (await res.json()) as {
        data: { pendingRotation: { systemId: string; bucketId: string } };
      };
      expect(body.data.pendingRotation.systemId).toBe(systemId);
      expect(body.data.pendingRotation.bucketId).toBe(bucketId);
    });

    await test.step("list is empty after unassign", async () => {
      const res = await request.get(`/v1/systems/${systemId}/buckets/${bucketId}/friends`, {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as BucketAssignmentListResponse;
      expect(body.data).toHaveLength(0);
    });
  });

  test("update visibility on connection", async ({
    request,
    friendAccounts: { accountA, connectionIdA },
  }) => {
    // Get initial version
    const getRes = await request.get(`/v1/account/friends/${connectionIdA}`, {
      headers: accountA.headers,
    });
    expect(getRes.ok()).toBe(true);
    const initial = (await getRes.json()) as { data: FriendConnectionResponse };
    const initialVersion = initial.data.version;

    // Update visibility with encrypted data
    const updateRes = await request.put(`/v1/account/friends/${connectionIdA}/visibility`, {
      headers: accountA.headers,
      data: {
        encryptedData: encryptForApi({ displayName: "My Friend" }),
        version: initialVersion,
      },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = (await updateRes.json()) as { data: FriendConnectionResponse };
    expect(updated.data.id).toBe(connectionIdA);
    expect(updated.data.version).toBe(initialVersion + 1);
    expect(updated.data.encryptedData).toBeTruthy();
  });

  test("block connection", async ({ request, friendAccounts: { accountA, connectionIdA } }) => {
    const res = await request.post(`/v1/account/friends/${connectionIdA}/block`, {
      headers: accountA.headers,
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { data: FriendConnectionResponse };
    expect(body.data.id).toBe(connectionIdA);
    expect(body.data.status).toBe("blocked");
  });

  test("remove connection", async ({ request, friendAccounts: { accountA, connectionIdA } }) => {
    const res = await request.post(`/v1/account/friends/${connectionIdA}/remove`, {
      headers: accountA.headers,
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { data: FriendConnectionResponse };
    expect(body.data.id).toBe(connectionIdA);
    expect(body.data.status).toBe("removed");
  });

  test("archive and restore connection", async ({
    request,
    friendAccounts: { accountA, connectionIdA },
  }) => {
    // ── Archive ──
    await test.step("archive connection", async () => {
      const res = await request.post(`/v1/account/friends/${connectionIdA}/archive`, {
        headers: accountA.headers,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("archived connection not in default list", async () => {
      const res = await request.get("/v1/account/friends", {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as FriendConnectionListResponse;
      const ids = body.data.map((c) => c.id);
      expect(ids).not.toContain(connectionIdA);
    });

    await test.step("archived connection in includeArchived list", async () => {
      const res = await request.get("/v1/account/friends?includeArchived=true", {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as FriendConnectionListResponse;
      const ids = body.data.map((c) => c.id);
      expect(ids).toContain(connectionIdA);
    });

    // ── Restore ──
    await test.step("restore connection", async () => {
      const res = await request.post(`/v1/account/friends/${connectionIdA}/restore`, {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: FriendConnectionResponse };
      expect(body.data.id).toBe(connectionIdA);
    });

    await test.step("restored connection back in default list", async () => {
      const res = await request.get("/v1/account/friends", {
        headers: accountA.headers,
      });
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as FriendConnectionListResponse;
      const ids = body.data.map((c) => c.id);
      expect(ids).toContain(connectionIdA);
    });
  });

  test("get non-existent connection returns 404", async ({
    request,
    friendAccounts: { accountA },
  }) => {
    const res = await request.get("/v1/account/friends/fc_00000000-0000-0000-0000-000000000001", {
      headers: accountA.headers,
    });
    expect(res.status()).toBe(404);
  });

  test("cross-account connection access returns 404", async ({
    request,
    friendAccounts: { accountA, connectionIdB },
  }) => {
    // Account A tries to access account B's connection ID
    const res = await request.get(`/v1/account/friends/${connectionIdB}`, {
      headers: accountA.headers,
    });
    expect(res.status()).toBe(404);
  });

  test("reject a pending friend connection", async ({ request }) => {
    const uuid1 = crypto.randomUUID();
    const uuid2 = crypto.randomUUID();
    const regA = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-reject-a-${uuid1}@test.pluralscape.local`,
        password: `E2E-Pass-${uuid1}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    const acctA = (await regA.json()) as { data: { sessionToken: string } };
    const headersA = { Authorization: `Bearer ${acctA.data.sessionToken}` };

    const regB = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-reject-b-${uuid2}@test.pluralscape.local`,
        password: `E2E-Pass-${uuid2}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    const acctB = (await regB.json()) as { data: { sessionToken: string } };
    const headersB = { Authorization: `Bearer ${acctB.data.sessionToken}` };

    const codeRes = await request.post("/v1/account/friend-codes", { headers: headersA });
    const codeBody = (await codeRes.json()) as { data: { code: string } };
    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: headersB,
      data: { code: codeBody.data.code },
    });
    const redeemBody = (await redeemRes.json()) as {
      data: { connectionIds: [string, string] };
    };
    const [connIdA] = redeemBody.data.connectionIds;

    const rejectRes = await request.post(`/v1/account/friends/${connIdA}/reject`, {
      headers: headersA,
    });
    expect(rejectRes.ok()).toBe(true);

    const listRes = await request.get("/v1/account/friends", { headers: headersA });
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; status: string }>;
    };
    const conn = listBody.data.find((c) => c.id === connIdA);
    if (conn) {
      expect(conn.status).toBe("removed");
    }
  });
});
