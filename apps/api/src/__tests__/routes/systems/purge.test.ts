import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system-purge.service.js", () => ({
  purgeSystem: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { purgeSystem } = await import("../../../services/system-purge.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const PURGE_URL = `/systems/${SYS_ID}/purge`;

const VALID_BODY = { authKey: "a".repeat(64) };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/purge", () => {
  beforeEach(() => {
    vi.mocked(purgeSystem).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(purgeSystem).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), PURGE_URL, VALID_BODY);

    expect(res.status).toBe(204);
  });

  it("passes systemId and body to service", async () => {
    vi.mocked(purgeSystem).mockResolvedValueOnce(undefined);

    await postJSON(createApp(), PURGE_URL, VALID_BODY);

    expect(vi.mocked(purgeSystem)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(createApp(), `/systems/not-valid/purge`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(PURGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [404, "NOT_FOUND", "System not found"],
    [409, "NOT_ARCHIVED", "System must be archived before permanent deletion"],
    [400, "VALIDATION_ERROR", "Account not found"],
    [400, "VALIDATION_ERROR", "Incorrect password"],
  ] as const)("maps service ApiHttpError %i %s to HTTP response", async (status, code, message) => {
    vi.mocked(purgeSystem).mockRejectedValueOnce(new ApiHttpError(status, code, message));

    const res = await postJSON(createApp(), PURGE_URL, VALID_BODY);

    expect(res.status).toBe(status);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe(code);
  });
});
