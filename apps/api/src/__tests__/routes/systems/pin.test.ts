import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/pin.service.js", () => ({
  setPin: vi.fn(),
  removePin: vi.fn(),
  verifyPinCode: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { setPin, removePin, verifyPinCode } = await import("../../../services/pin.service.js");
const { pinRoutes } = await import("../../../routes/systems/settings/pin/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/:systemId/pin", pinRoutes);

async function deleteJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /:id/pin", () => {
  beforeEach(() => {
    vi.mocked(setPin).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with success in data envelope", async () => {
    vi.mocked(setPin).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/pin`, { pin: "1234" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { success: boolean } };
    expect(body.data.success).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(setPin).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/pin`, { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /:id/pin", () => {
  beforeEach(() => {
    vi.mocked(removePin).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with success in data envelope", async () => {
    vi.mocked(removePin).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await deleteJSON(app, `/${SYS_ID}/pin`, { pin: "1234" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { success: boolean } };
    expect(body.data.success).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/pin`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(removePin).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await deleteJSON(app, `/${SYS_ID}/pin`, { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /:id/pin/verify", () => {
  beforeEach(() => {
    vi.mocked(verifyPinCode).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(verifyPinCode).mockResolvedValueOnce({ verified: true });

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/pin/verify`, { pin: "1234" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean };
    expect(body.verified).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/${SYS_ID}/pin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(verifyPinCode).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/${SYS_ID}/pin/verify`, { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
