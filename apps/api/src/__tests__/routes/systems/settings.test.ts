import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse, SystemId, SystemSettingsId, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../services/system-settings.service.js", () => ({
  getSystemSettings: vi.fn(),
  updateSystemSettings: vi.fn(),
  toSystemSettingsResult: vi.fn(),
}));

// Also mock pin service since pinRoutes is mounted as a sub-route of settingsRoutes
vi.mock("../../../services/pin.service.js", () => ({
  setPin: vi.fn(),
  removePin: vi.fn(),
  verifyPinCode: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(
      () => async (c: { set: (key: string, val: unknown) => void }, next: () => Promise<void>) => {
        c.set("auth", {
          accountId: "acct_test",
          systemId: "sys_test",
          sessionId: "sess_test",
          accountType: "system",
        });
        await next();
      },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getSystemSettings, updateSystemSettings } =
  await import("../../../services/system-settings.service.js");
const { settingsRoutes } = await import("../../../routes/systems/settings/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/:systemId/settings", settingsRoutes);
  app.onError(errorHandler);
  return app;
}

async function putJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const MOCK_SETTINGS = {
  id: "sset_abc" as SystemSettingsId,
  systemId: SYS_ID as SystemId,
  locale: "en-US",
  biometricEnabled: false,
  encryptedData: "base64data",
  version: 1,
  createdAt: 1700000000000 as UnixMillis,
  updatedAt: 1700000000000 as UnixMillis,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /:id/settings", () => {
  beforeEach(() => {
    vi.mocked(getSystemSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(getSystemSettings).mockResolvedValueOnce(MOCK_SETTINGS);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/settings`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_SETTINGS;
    expect(body.id).toBe("sset_abc");
    expect(body.locale).toBe("en-US");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(getSystemSettings).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/settings`);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /:id/settings", () => {
  beforeEach(() => {
    vi.mocked(updateSystemSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(updateSystemSettings).mockResolvedValueOnce(MOCK_SETTINGS);

    const app = createApp();
    const res = await putJSON(app, `/${SYS_ID}/settings`, { encryptedData: "data", version: 1 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_SETTINGS;
    expect(body.id).toBe("sset_abc");
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(updateSystemSettings).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, `/${SYS_ID}/settings`, { encryptedData: "data", version: 1 });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
