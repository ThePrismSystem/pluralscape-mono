import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi } from "../../fixtures/crypto.fixture.js";
import { createBucket, getSystemId } from "../../fixtures/entity-helpers.js";

import type { APIRequestContext } from "@playwright/test";

interface VisibilityEntry {
  fieldDefinitionId: string;
  bucketId: string;
}

async function createFieldDefinition(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
): Promise<{ id: string }> {
  const res = await request.post(`/v1/systems/${systemId}/fields`, {
    headers,
    data: {
      encryptedData: encryptForApi({ name: "E2E Test Field" }),
      fieldType: "text",
      scope: { type: "member" },
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data;
}

test.describe("Field Bucket Visibility", () => {
  test("set, list, remove lifecycle", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Vis Test Bucket");
    const field = await createFieldDefinition(request, authHeaders, systemId);

    // ── Set visibility ──
    await test.step("set field bucket visibility", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility`,
        {
          headers: authHeaders,
          data: { bucketId: bucket.id },
        },
      );
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { data: VisibilityEntry };
      expect(body.data.fieldDefinitionId).toBe(field.id);
      expect(body.data.bucketId).toBe(bucket.id);
    });

    // ── List visibility ──
    await test.step("list field bucket visibility", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility`,
        { headers: authHeaders },
      );
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: VisibilityEntry[] };
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const entry = body.data.find((v) => v.bucketId === bucket.id);
      expect(entry).toBeTruthy();
    });

    // ── Remove visibility ──
    await test.step("remove field bucket visibility", async () => {
      const res = await request.delete(
        `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility/${bucket.id}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(204);
    });

    // ── Verify removed ──
    await test.step("visibility no longer in list", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility`,
        { headers: authHeaders },
      );
      expect(res.ok()).toBe(true);
      const body = (await res.json()) as { data: VisibilityEntry[] };
      const entry = body.data.find((v) => v.bucketId === bucket.id);
      expect(entry).toBeUndefined();
    });
  });

  test("idempotent set", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId);
    const field = await createFieldDefinition(request, authHeaders, systemId);

    const url = `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility`;
    const data = { bucketId: bucket.id };

    const res1 = await request.post(url, { headers: authHeaders, data });
    expect(res1.status()).toBe(201);

    const res2 = await request.post(url, { headers: authHeaders, data });
    expect(res2.status()).toBe(201);
  });

  test("set visibility with non-existent field returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const bucket = await createBucket(request, authHeaders, systemId, "Vis Field 404 Test");

    const res = await request.post(
      `/v1/systems/${systemId}/fields/fld_00000000-0000-0000-0000-000000000001/bucket-visibility`,
      {
        headers: authHeaders,
        data: { bucketId: bucket.id },
      },
    );
    expect(res.status()).toBe(404);
  });

  test("set visibility with non-existent bucket returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const field = await createFieldDefinition(request, authHeaders, systemId);

    const res = await request.post(`/v1/systems/${systemId}/fields/${field.id}/bucket-visibility`, {
      headers: authHeaders,
      data: { bucketId: "bkt_00000000-0000-0000-0000-000000000001" },
    });
    expect(res.status()).toBe(404);
  });

  test("remove non-existent visibility returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const field = await createFieldDefinition(request, authHeaders, systemId);

    const res = await request.delete(
      `/v1/systems/${systemId}/fields/${field.id}/bucket-visibility/bkt_00000000-0000-0000-0000-000000000001`,
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });
});
