import { toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

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

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { getRecoveryKeyStatus, regenerateRecoveryKeyBackup, NoActiveRecoveryKeyError } =
  await import("../../../services/recovery-key.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { recoveryKeyRoutes } = await import("../../../routes/auth/recovery-key.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/auth/recovery-key", recoveryKeyRoutes);

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
      createdAt: toUnixMillis(1000),
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { hasActiveKey: boolean; createdAt: number | null };
    };
    expect(body.data.hasActiveKey).toBe(true);
    expect(body.data.createdAt).toBe(1000);
  });

  it("returns status without active key", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: false,
      createdAt: null,
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { hasActiveKey: boolean; createdAt: number | null };
    };
    expect(body.data.hasActiveKey).toBe(false);
    expect(body.data.createdAt).toBeNull();
  });

  it("passes account ID from auth context to service", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: true,
      createdAt: toUnixMillis(1000),
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
    const body = (await res.json()) as { data: { recoveryKey: string } };
    expect(body.data.recoveryKey).toBe(
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
