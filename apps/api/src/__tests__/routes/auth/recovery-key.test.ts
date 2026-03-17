import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/recovery-key.service.js", () => ({
  getRecoveryKeyStatus: vi.fn(),
  regenerateRecoveryKeyBackup: vi.fn(),
  NoActiveRecoveryKeyError: class NoActiveRecoveryKeyError extends Error {
    override readonly name = "NoActiveRecoveryKeyError" as const;
  },
}));

vi.mock("../../../services/auth.service.js", () => ({
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
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
      () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
          c.set("auth", {
            accountId: "acct_test",
            sessionId: "sess_current",
            systemId: null,
            accountType: "system",
          });
          await next();
        },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { getRecoveryKeyStatus, regenerateRecoveryKeyBackup, NoActiveRecoveryKeyError } =
  await import("../../../services/recovery-key.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { recoveryKeyRoutes } = await import("../../../routes/auth/recovery-key.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/auth/recovery-key", recoveryKeyRoutes);
  app.onError(errorHandler);
  return app;
}

// ── GET /auth/recovery-key/status ────────────────────────────────

describe("GET /auth/recovery-key/status", () => {
  beforeEach(() => {
    vi.mocked(getRecoveryKeyStatus).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns status with active key", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: true,
      createdAt: 1000 as UnixMillis,
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasActiveKey: boolean; createdAt: number | null };
    expect(body.hasActiveKey).toBe(true);
    expect(body.createdAt).toBe(1000);
  });

  it("returns status without active key", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: false,
      createdAt: null,
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasActiveKey: boolean; createdAt: number | null };
    expect(body.hasActiveKey).toBe(false);
    expect(body.createdAt).toBeNull();
  });

  it("passes account ID from auth context to service", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: true,
      createdAt: 1000 as UnixMillis,
    });

    const app = createApp();
    await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(vi.mocked(getRecoveryKeyStatus)).toHaveBeenCalledWith({}, "acct_test");
  });
});

// ── POST /auth/recovery-key/regenerate ───────────────────────────

describe("POST /auth/recovery-key/regenerate", () => {
  beforeEach(() => {
    vi.mocked(regenerateRecoveryKeyBackup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns recovery key on success", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      recoveryKey: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "password123", confirmed: true }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { recoveryKey: string };
    expect(body.recoveryKey).toBe(
      "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
    );
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockRejectedValueOnce(
      new ValidationError("Incorrect password"),
    );

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "wrong", confirmed: true }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 on NoActiveRecoveryKeyError", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockRejectedValueOnce(
      new NoActiveRecoveryKeyError("No active recovery key to revoke"),
    );

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "password123", confirmed: true }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 on malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("returns 400 on ZodError from service", async () => {
    const zodError = new Error("Invalid input");
    zodError.name = "ZodError";
    vi.mocked(regenerateRecoveryKeyBackup).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "password123", confirmed: true }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("passes account ID and audit writer to service", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      recoveryKey: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
    });

    const app = createApp();
    await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "password123", confirmed: true }),
    });

    expect(vi.mocked(regenerateRecoveryKeyBackup)).toHaveBeenCalledWith(
      {},
      "acct_test",
      { currentPassword: "password123", confirmed: true },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test" }),
    );
  });
});
