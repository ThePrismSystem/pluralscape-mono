import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, SystemId, SystemSettingsId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

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

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getSystemSettings, updateSystemSettings } =
  await import("../../../services/system-settings.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { settingsRoutes } = await import("../../../routes/systems/settings/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/:systemId/settings", settingsRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const MOCK_SETTINGS = {
  id: brandId<SystemSettingsId>("sset_abc"),
  systemId: brandId<SystemId>(SYS_ID),
  locale: "en-US",
  biometricEnabled: false,
  encryptedData: "base64data",
  version: 1,
  createdAt: toUnixMillis(1700000000000),
  updatedAt: toUnixMillis(1700000000000),
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
    const body = (await res.json()) as { data: typeof MOCK_SETTINGS };
    expect(body.data.id).toBe("sset_abc");
    expect(body.data.locale).toBe("en-US");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
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
    const body = (await res.json()) as { data: typeof MOCK_SETTINGS };
    expect(body.data.id).toBe("sset_abc");
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
