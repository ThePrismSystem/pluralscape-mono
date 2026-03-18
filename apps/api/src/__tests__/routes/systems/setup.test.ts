import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse, SystemId, SystemSettingsId, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../services/setup.service.js", () => ({
  getSetupStatus: vi.fn(),
  setupNomenclatureStep: vi.fn(),
  setupProfileStep: vi.fn(),
  setupComplete: vi.fn(),
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

const { getSetupStatus, setupNomenclatureStep, setupProfileStep, setupComplete } =
  await import("../../../services/setup.service.js");
const { setupRoutes } = await import("../../../routes/systems/setup/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/:systemId/setup", setupRoutes);
  app.onError(errorHandler);
  return app;
}

async function postJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const MOCK_STATUS = {
  nomenclatureComplete: false,
  profileComplete: false,
  settingsCreated: false,
  recoveryKeyBackedUp: false,
  isComplete: false,
};

const MOCK_STEP_RESULT = { success: true as const };

const MOCK_COMPLETE_RESULT = {
  id: "sset_abc" as SystemSettingsId,
  systemId: SYS_ID as SystemId,
  locale: null,
  biometricEnabled: false,
  encryptedData: "base64data",
  version: 1,
  createdAt: 1700000000000 as UnixMillis,
  updatedAt: 1700000000000 as UnixMillis,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /:id/setup/status", () => {
  beforeEach(() => {
    vi.mocked(getSetupStatus).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(getSetupStatus).mockResolvedValueOnce(MOCK_STATUS);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/setup/status`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_STATUS;
    expect(body.isComplete).toBe(false);
    expect(body.nomenclatureComplete).toBe(false);
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(getSetupStatus).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/${SYS_ID}/setup/status`);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /:id/setup/nomenclature", () => {
  beforeEach(() => {
    vi.mocked(setupNomenclatureStep).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(setupNomenclatureStep).mockResolvedValueOnce(MOCK_STEP_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/nomenclature`, { encryptedData: "data" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_STEP_RESULT;
    expect(body.success).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/setup/nomenclature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(setupNomenclatureStep).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/nomenclature`, { encryptedData: "data" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /:id/setup/profile", () => {
  beforeEach(() => {
    vi.mocked(setupProfileStep).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(setupProfileStep).mockResolvedValueOnce(MOCK_STEP_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/profile`, { encryptedData: "data" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_STEP_RESULT;
    expect(body.success).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/setup/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(setupProfileStep).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/profile`, { encryptedData: "data" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /:id/setup/complete", () => {
  beforeEach(() => {
    vi.mocked(setupComplete).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(setupComplete).mockResolvedValueOnce(MOCK_COMPLETE_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/complete`, {
      encryptedData: "data",
      recoveryKeyBackupConfirmed: true,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_COMPLETE_RESULT;
    expect(body.id).toBe("sset_abc");
    expect(body.version).toBe(1);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/setup/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(setupComplete).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/complete`, {
      encryptedData: "data",
      recoveryKeyBackupConfirmed: true,
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
