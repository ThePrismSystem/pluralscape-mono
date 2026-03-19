import { expect, test } from "@playwright/test";

test.describe("Health and infrastructure", () => {
  test("GET /health returns 200", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "healthy" });
  });

  test("GET / returns service info", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "pluralscape-api" });
  });

  test("X-Request-Id header is present on responses", async ({ request }) => {
    const res = await request.get("/health");
    const requestId = res.headers()["x-request-id"];
    expect(requestId).toBeTruthy();
  });
});
