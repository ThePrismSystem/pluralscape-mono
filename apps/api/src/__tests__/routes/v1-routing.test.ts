import { describe, expect, it } from "vitest";

import { app } from "../../index.js";

describe("v1 route prefix", () => {
  it("GET /health returns 200 (unversioned)", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "healthy" });
  });

  it("GET / returns 200 (unversioned)", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "pluralscape-api" });
  });

  it("POST /v1/auth/register with invalid body returns 400 (versioned route exists)", async () => {
    const res = await app.request("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // The route exists and processes the request — it may return 400 (validation)
    // or 500 (rate limiter/DB not available in unit test env). Either proves routing works.
    // A 404 would mean the route is not mounted.
    expect(res.status).not.toBe(404);
  });

  it("POST /auth/register returns 404 (old unversioned path removed)", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it("GET /v1/account returns non-404 (account routes mounted)", async () => {
    const res = await app.request("/v1/account");
    expect(res.status).not.toBe(404);
  });

  it("GET /v1/systems returns non-404 (system routes mounted)", async () => {
    const res = await app.request("/v1/systems");
    expect(res.status).not.toBe(404);
  });
});
