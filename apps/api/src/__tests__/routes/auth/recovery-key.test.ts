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

// Queue mock — exposed so tests can swap behavior per case
interface EnqueueArg {
  readonly payload?: { readonly vars?: { readonly deviceInfo?: string } };
}
interface MockQueue {
  enqueue: ReturnType<typeof vi.fn<(arg: EnqueueArg) => Promise<unknown>>>;
}
const mockEnqueue = vi.fn<(arg: EnqueueArg) => Promise<unknown>>(() => Promise.resolve({}));
const mockQueue: MockQueue = { enqueue: mockEnqueue };
const mockGetQueue = vi.fn<() => MockQueue | null>(() => mockQueue);
vi.mock("../../../lib/queue.js", () => ({
  getQueue: () => mockGetQueue(),
}));
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { getRecoveryKeyStatus, regenerateRecoveryKeyBackup, NoActiveRecoveryKeyError } =
  await import("../../../services/recovery-key.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { recoveryKeyRoutes } = await import("../../../routes/auth/recovery-key.js");
const { authRoutes } = await import("../../../routes/auth/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/auth/recovery-key", recoveryKeyRoutes);
const createAuthApp = () => createRouteApp("/auth", authRoutes);

// ── Cache-Control ──────────────────────────────────────────────

describe("Cache-Control", () => {
  it("sets Cache-Control: no-store on GET /auth/recovery-key/status", async () => {
    vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
      hasActiveKey: true,
      createdAt: toUnixMillis(1000),
    });

    const app = createAuthApp();
    const res = await app.request("/auth/recovery-key/status", { method: "GET" });

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Cache-Control: no-store on POST /auth/recovery-key/regenerate", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });

    const app = createAuthApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

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

    expect(vi.mocked(getRecoveryKeyStatus)).toHaveBeenCalledWith({}, "acct_test001");
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

  it("returns ok on success", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockRejectedValueOnce(
      new ValidationError("Incorrect password"),
    );

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
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
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
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
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("passes account ID and audit writer to service", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });

    const app = createApp();
    await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(vi.mocked(regenerateRecoveryKeyBackup)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      { authKey: "a".repeat(64), newRecoveryEncryptedMasterKey: "deadbeef", confirmed: true },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test001" }),
    );
  });

  it("succeeds even when getQueue() returns null (queue disabled branch)", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });
    mockGetQueue.mockReturnValueOnce(null);
    mockEnqueue.mockClear();

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(res.status).toBe(201);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues email notification with user-agent when present", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });
    mockEnqueue.mockClear();

    const app = createApp();
    await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "test-agent/1.0" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const callArg = mockEnqueue.mock.calls[0]?.[0] as
      | { payload?: { vars?: { deviceInfo?: string } } }
      | undefined;
    expect(callArg?.payload?.vars?.deviceInfo).toBe("test-agent/1.0");
  });

  it("falls back to 'Unknown device' when user-agent header is absent", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });
    mockEnqueue.mockClear();

    const app = createApp();
    await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const callArg = mockEnqueue.mock.calls[0]?.[0] as
      | { payload?: { vars?: { deviceInfo?: string } } }
      | undefined;
    expect(callArg?.payload?.vars?.deviceInfo).toBe("Unknown device");
  });

  it("does not fail the request when queue.enqueue rejects", async () => {
    vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValueOnce({
      ok: true as const,
    });
    mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    expect(res.status).toBe(201);
  });

  it("re-throws unknown errors from regenerateRecoveryKeyBackup", async () => {
    // Generic error that is not NoActiveRecoveryKeyError, ValidationError, or ZodError
    vi.mocked(regenerateRecoveryKeyBackup).mockRejectedValueOnce(new Error("internal db failure"));

    const app = createApp();
    const res = await app.request("/auth/recovery-key/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authKey: "a".repeat(64),
        newRecoveryEncryptedMasterKey: "deadbeef",
        confirmed: true,
      }),
    });

    // Re-thrown errors surface as 500 from the global error handler
    expect(res.status).toBe(500);
  });
});
