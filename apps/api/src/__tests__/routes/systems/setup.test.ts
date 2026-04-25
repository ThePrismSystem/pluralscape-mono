import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type {
  EncryptedBase64,
  ApiErrorResponse,
  SystemId,
  SystemSettingsId,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/setup.service.js", () => ({
  getSetupStatus: vi.fn(),
  setupNomenclatureStep: vi.fn(),
  setupProfileStep: vi.fn(),
  setupComplete: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getSetupStatus, setupNomenclatureStep, setupProfileStep, setupComplete } =
  await import("../../../services/setup.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { setupRoutes } = await import("../../../routes/systems/setup/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/:systemId/setup", setupRoutes);

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
  id: brandId<SystemSettingsId>("sset_abc"),
  systemId: brandId<SystemId>(SYS_ID),
  locale: null,
  biometricEnabled: false,
  encryptedData: "base64data" as EncryptedBase64,
  version: 1,
  createdAt: toUnixMillis(1700000000000),
  updatedAt: toUnixMillis(1700000000000),
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
    const body = (await res.json()) as { data: typeof MOCK_STATUS };
    expect(body.data.isComplete).toBe(false);
    expect(body.data.nomenclatureComplete).toBe(false);
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
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

  it("returns 204 with no body", async () => {
    vi.mocked(setupNomenclatureStep).mockResolvedValueOnce(MOCK_STEP_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/nomenclature`, {
      encryptedData: "data" as EncryptedBase64,
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("content-length")).toBeNull();
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
    const res = await postJSON(app, `/${SYS_ID}/setup/nomenclature`, {
      encryptedData: "data" as EncryptedBase64,
    });

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

  it("returns 204 with no body", async () => {
    vi.mocked(setupProfileStep).mockResolvedValueOnce(MOCK_STEP_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/setup/profile`, {
      encryptedData: "data" as EncryptedBase64,
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("content-length")).toBeNull();
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
    const res = await postJSON(app, `/${SYS_ID}/setup/profile`, {
      encryptedData: "data" as EncryptedBase64,
    });

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
      encryptedData: "data" as EncryptedBase64,
      recoveryKeyBackupConfirmed: true,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_COMPLETE_RESULT };
    expect(body.data.id).toBe("sset_abc");
    expect(body.data.version).toBe(1);
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
      encryptedData: "data" as EncryptedBase64,
      recoveryKeyBackupConfirmed: true,
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
