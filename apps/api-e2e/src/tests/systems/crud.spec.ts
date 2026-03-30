import { expect, test } from "../../fixtures/auth.fixture.js";

test.describe("Systems CRUD", () => {
  test("POST /v1/systems creates a system", async ({ request, authHeaders }) => {
    const res = await request.post("/v1/systems", { headers: authHeaders });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("id");
  });

  test("GET /v1/systems lists owned systems", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems", { headers: authHeaders });

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Paginated response with items array
    expect(body).toHaveProperty("data");
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /v1/systems/:id returns a single system", async ({ request, authHeaders }) => {
    const listRes = await request.get("/v1/systems", { headers: authHeaders });
    const body = await listRes.json();
    const systemId = body.data[0].id as string;

    const res = await request.get(`/v1/systems/${systemId}`, { headers: authHeaders });
    expect(res.status()).toBe(200);
    const system = await res.json();
    expect(system.data.id).toBe(systemId);
  });

  test("missing Bearer token returns 401", async ({ request }) => {
    const res = await request.get("/v1/systems");
    expect(res.status()).toBe(401);
  });

  test("garbage Bearer token returns 401", async ({ request }) => {
    const res = await request.get("/v1/systems", {
      headers: { Authorization: "Bearer not-a-valid-token" },
    });
    expect(res.status()).toBe(401);
  });
});
