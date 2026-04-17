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

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
  changeEmail: vi.fn(),
  ConcurrencyError: class ConcurrencyError extends Error {
    override readonly name = "ConcurrencyError" as const;
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

// Queue mock — exposed so tests can assert enqueue behavior per case
interface EnqueueArg {
  readonly type: string;
  readonly payload: {
    readonly accountId: string;
    readonly template: string;
    readonly vars: Readonly<Record<string, unknown>>;
    readonly recipientOverride?: string;
  };
  readonly idempotencyKey?: string;
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
const { changeEmail, ConcurrencyError } = await import("../../../services/account.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/email", () => {
  beforeEach(() => {
    vi.mocked(changeEmail).mockReset();
    mockEnqueue.mockClear();
    mockGetQueue.mockReturnValue(mockQueue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok on successful email change", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(new ValidationError("Incorrect password"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "wrong" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on email change failed (duplicate)", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(new ValidationError("Email change failed"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "taken@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 409 on ConcurrencyError", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(
      new ConcurrencyError("Account was modified concurrently"),
    );

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("passes request body to changeEmail service", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: null,
      newEmail: null,
    });

    const app = createApp();
    await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(vi.mocked(changeEmail)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      { email: "new@example.com", currentPassword: "password123" },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test001" }),
    );
  });

  it("enqueues account-change-email notification with recipientOverride = old email", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const callArg = mockEnqueue.mock.calls[0]?.[0];
    expect(callArg?.type).toBe("email-send");
    expect(callArg?.payload.template).toBe("account-change-email");
    expect(callArg?.payload.recipientOverride).toBe("old@example.com");
    expect(callArg?.payload.vars).toMatchObject({
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    });
    expect(callArg?.payload.vars).toHaveProperty("timestamp");
  });

  it("skips enqueue when oldEmail is null (encrypted email unresolved)", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: null,
      newEmail: null,
    });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("succeeds when queue is disabled (getQueue returns null)", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    });
    mockGetQueue.mockReturnValueOnce(null);

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("does not fail the request when queue.enqueue rejects", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      ok: true,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    });
    mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);
  });
});
