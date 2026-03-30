import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { parseJsonBody } from "../../lib/parse-json-body.js";
import { errorHandler } from "../../middleware/error-handler.js";

function createTestApp() {
  const app = new Hono();
  app.onError(errorHandler);
  app.post("/test", async (c) => {
    const body = await parseJsonBody(c);
    return c.json({ received: body });
  });
  return app;
}

interface ErrorBody {
  error: { code: string; message: string };
}

describe("parseJsonBody", () => {
  it("returns parsed JSON body on success", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { received: { email: string } };
    expect(data.received).toEqual({ email: "test@example.com" });
  });

  it("accepts Content-Type with charset parameter", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { received: { ok: boolean } };
    expect(data.received).toEqual({ ok: true });
  });

  it("rejects request with text/plain Content-Type with 415", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(415);
    const data = (await res.json()) as ErrorBody;
    expect(data.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(data.error.message).toBe("Content-Type must be application/json");
  });

  it("rejects request with missing Content-Type with 415", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(415);
    const data = (await res.json()) as ErrorBody;
    expect(data.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects invalid JSON body with 400", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorBody;
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toBe("Invalid JSON body");
  });
});
