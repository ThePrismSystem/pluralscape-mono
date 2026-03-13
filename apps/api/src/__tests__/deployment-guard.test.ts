import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { requireSelfHosted } from "../middleware/deployment-guard.js";

describe("requireSelfHosted middleware", () => {
  const originalEnv = process.env["DEPLOYMENT_MODE"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["DEPLOYMENT_MODE"];
    } else {
      process.env["DEPLOYMENT_MODE"] = originalEnv;
    }
  });

  function createApp(): Hono {
    const app = new Hono();
    app.use("/guarded/*", requireSelfHosted);
    app.get("/guarded/search", (c) => c.json({ ok: true }));
    app.get("/open/health", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns 403 in hosted mode", async () => {
    process.env["DEPLOYMENT_MODE"] = "hosted";
    const app = createApp();
    const res = await app.request("/guarded/search");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("self-hosted");
  });

  it("passes through in self-hosted mode", async () => {
    process.env["DEPLOYMENT_MODE"] = "self-hosted";
    const app = createApp();
    const res = await app.request("/guarded/search");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("passes through when DEPLOYMENT_MODE is unset (defaults to self-hosted)", async () => {
    delete process.env["DEPLOYMENT_MODE"];
    const app = createApp();
    const res = await app.request("/guarded/search");
    expect(res.status).toBe(200);
  });

  it("does not affect unguarded routes", async () => {
    process.env["DEPLOYMENT_MODE"] = "hosted";
    const app = createApp();
    const res = await app.request("/open/health");
    expect(res.status).toBe(200);
  });
});
