import { expect, test } from "../../fixtures/auth.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

/**
 * Bucket Key Rotation E2E Tests
 *
 * The full rotation lifecycle (initiate -> claim -> complete -> verify progress)
 * requires privacy bucket infrastructure that does not yet exist in E2E:
 *   - A bucket creation endpoint (no POST /v1/systems/:systemId/buckets route exists)
 *   - Content tagged to the bucket via bucketContentTags
 *   - Key grants for the bucket
 *
 * Without a bucket creation API, only error-path tests are feasible:
 *   - 404 for non-existent rotation
 *   - 400 for invalid request body
 *   - 404 for wrong system access
 *
 * Full lifecycle tests tracked in bean api-7spq (blocked on bucket CRUD routes).
 */

test.describe("Bucket Key Rotation", () => {
  test("get progress on non-existent rotation returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fakeBucketId = "bkt_00000000-0000-0000-0000-000000000002";
    const fakeRotationId = "bkr_00000000-0000-0000-0000-000000000099";
    const progressUrl = `/v1/systems/${systemId}/buckets/${fakeBucketId}/rotations/${fakeRotationId}`;

    const res = await request.get(progressUrl, { headers: authHeaders });
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
  });

  test("claim on non-existent rotation returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fakeBucketId = "bkt_00000000-0000-0000-0000-000000000003";
    const fakeRotationId = "bkr_00000000-0000-0000-0000-000000000099";
    const claimUrl = `/v1/systems/${systemId}/buckets/${fakeBucketId}/rotations/${fakeRotationId}/claim`;

    const res = await request.post(claimUrl, {
      headers: authHeaders,
      data: { chunkSize: 10 },
    });
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
  });

  test("complete chunk on non-existent rotation returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fakeBucketId = "bkt_00000000-0000-0000-0000-000000000004";
    const fakeRotationId = "bkr_00000000-0000-0000-0000-000000000099";
    const completeUrl = `/v1/systems/${systemId}/buckets/${fakeBucketId}/rotations/${fakeRotationId}/complete`;

    const res = await request.post(completeUrl, {
      headers: authHeaders,
      data: {
        items: [{ itemId: "bri_00000000-0000-0000-0000-000000000001", status: "completed" }],
      },
    });
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
  });

  test("initiate rotation with invalid body returns 400", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const fakeBucketId = "bkt_00000000-0000-0000-0000-000000000005";
    const rotationsUrl = `/v1/systems/${systemId}/buckets/${fakeBucketId}/rotations`;

    const res = await request.post(rotationsUrl, {
      headers: authHeaders,
      data: {
        // Missing required fields: wrappedNewKey, newKeyVersion, friendKeyGrants
      },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });

  test("initiate rotation on wrong system returns 404", async ({ request, authHeaders }) => {
    const fakeSystemId = "sys_00000000-0000-0000-0000-000000000000";
    const fakeBucketId = "bkt_00000000-0000-0000-0000-000000000006";
    const rotationsUrl = `/v1/systems/${fakeSystemId}/buckets/${fakeBucketId}/rotations`;

    const res = await request.post(rotationsUrl, {
      headers: authHeaders,
      data: {
        wrappedNewKey: "dGVzdC13cmFwcGVkLWtleQ==",
        newKeyVersion: 2,
        friendKeyGrants: [],
      },
    });
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
  });
});
