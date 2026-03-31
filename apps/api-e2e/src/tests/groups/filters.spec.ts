import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createGroup, getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_OK } from "../../fixtures/http.constants.js";

test.describe("Group list filters", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("list groups returns all groups by default", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await createGroup(request, authHeaders, systemId, { name: "Filter Test Group" });

    const res = await request.get(`/v1/systems/${systemId}/groups`, { headers: authHeaders });
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("list groups supports limit parameter", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    await createGroup(request, authHeaders, systemId, { name: "Group A" });
    await createGroup(request, authHeaders, systemId, { name: "Group B" });

    const res = await request.get(`/v1/systems/${systemId}/groups?limit=1`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(HTTP_OK);
    const body = (await res.json()) as { data: unknown[]; hasMore: boolean };
    expect(body.data.length).toBe(1);
    expect(body.hasMore).toBe(true);
  });

  test("list groups supports includeArchived parameter", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const group = await createGroup(request, authHeaders, systemId, { name: "To Archive" });

    await request.post(`/v1/systems/${systemId}/groups/${group.id}/archive`, {
      headers: authHeaders,
    });

    const withoutArchived = await request.get(`/v1/systems/${systemId}/groups`, {
      headers: authHeaders,
    });
    const body1 = (await withoutArchived.json()) as { data: Array<{ id: string }> };
    expect(body1.data.map((g) => g.id)).not.toContain(group.id);

    const withArchived = await request.get(`/v1/systems/${systemId}/groups?includeArchived=true`, {
      headers: authHeaders,
    });
    const body2 = (await withArchived.json()) as { data: Array<{ id: string }> };
    expect(body2.data.map((g) => g.id)).toContain(group.id);
  });
});
