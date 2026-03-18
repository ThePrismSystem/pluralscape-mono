import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse, SystemId, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../services/nomenclature.service.js", () => ({
  getNomenclatureSettings: vi.fn(),
  updateNomenclatureSettings: vi.fn(),
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
          ownedSystemIds: new Set(["sys_test"]),
        });
        await next();
      },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getNomenclatureSettings, updateNomenclatureSettings } =
  await import("../../../services/nomenclature.service.js");
const { nomenclatureRoutes } = await import("../../../routes/systems/nomenclature/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/:systemId/nomenclature", nomenclatureRoutes);
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

const MOCK_RESULT = {
  systemId: SYS_ID as SystemId,
  encryptedData: "base64data",
  version: 1,
  createdAt: 1700000000000 as UnixMillis,
  updatedAt: 1700000000000 as UnixMillis,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /:id/nomenclature", () => {
  beforeEach(() => {
    vi.mocked(getNomenclatureSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(getNomenclatureSettings).mockResolvedValueOnce(MOCK_RESULT);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/nomenclature`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_RESULT;
    expect(body.systemId).toBe(SYS_ID);
    expect(body.version).toBe(1);
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(getNomenclatureSettings).mockRejectedValueOnce(
      new Error("Database connection failed"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/nomenclature`);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /:id/nomenclature", () => {
  beforeEach(() => {
    vi.mocked(updateNomenclatureSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(updateNomenclatureSettings).mockResolvedValueOnce(MOCK_RESULT);

    const app = createApp();
    const res = await putJSON(app, `/${SYS_ID}/nomenclature`, {
      encryptedData: "data",
      version: 1,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_RESULT;
    expect(body.systemId).toBe(SYS_ID);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/nomenclature`, {
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
    vi.mocked(updateNomenclatureSettings).mockRejectedValueOnce(
      new Error("Database connection failed"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, `/${SYS_ID}/nomenclature`, {
      encryptedData: "data",
      version: 1,
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
