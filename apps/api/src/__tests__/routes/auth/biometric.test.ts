import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse, BiometricTokenId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../services/biometric.service.js", () => ({
  enrollBiometric: vi.fn(),
  verifyBiometric: vi.fn(),
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

const { enrollBiometric, verifyBiometric } = await import("../../../services/biometric.service.js");
const { biometricRoute } = await import("../../../routes/auth/biometric.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/biometric", biometricRoute);
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

const VALID_ENROLL_BODY = { token: "my-biometric-token" };
const VALID_VERIFY_BODY = { token: "my-biometric-token" };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /biometric/enroll", () => {
  beforeEach(() => {
    vi.mocked(enrollBiometric).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with result on success", async () => {
    vi.mocked(enrollBiometric).mockResolvedValueOnce({
      id: "bt_test123" as BiometricTokenId,
    });

    const app = createApp();
    const res = await postJSON(app, "/biometric/enroll", VALID_ENROLL_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("bt_test123");
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/biometric/enroll", {
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
    vi.mocked(enrollBiometric).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/biometric/enroll", VALID_ENROLL_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /biometric/verify", () => {
  beforeEach(() => {
    vi.mocked(verifyBiometric).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(verifyBiometric).mockResolvedValueOnce({
      verified: true,
    });

    const app = createApp();
    const res = await postJSON(app, "/biometric/verify", VALID_VERIFY_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean };
    expect(body.verified).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/biometric/verify", {
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
    vi.mocked(verifyBiometric).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/biometric/verify", VALID_VERIFY_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
