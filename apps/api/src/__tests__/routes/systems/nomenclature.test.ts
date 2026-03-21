import { toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/nomenclature.service.js", () => ({
  getNomenclatureSettings: vi.fn(),
  updateNomenclatureSettings: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getNomenclatureSettings, updateNomenclatureSettings } =
  await import("../../../services/nomenclature.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { nomenclatureRoutes } = await import("../../../routes/systems/nomenclature/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/:systemId/nomenclature", nomenclatureRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const MOCK_RESULT = {
  systemId: SYS_ID as SystemId,
  encryptedData: "base64data",
  version: 1,
  createdAt: toUnixMillis(1700000000000),
  updatedAt: toUnixMillis(1700000000000),
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

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
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
