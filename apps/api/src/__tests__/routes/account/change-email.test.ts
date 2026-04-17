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
  enqueueAccountEmailChangedNotification: vi.fn().mockResolvedValue(undefined),
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

// Queue mock — the route no longer calls enqueue directly; the
// `enqueueAccountEmailChangedNotification` helper owns that responsibility.
// We still mock `getQueue` because the route passes its return value to the
// helper, and we want to exercise both the "queue present" and "queue null"
// paths at the route level.
interface MockQueue {
  enqueue: ReturnType<typeof vi.fn>;
}
const mockQueue: MockQueue = { enqueue: vi.fn() };
const mockGetQueue = vi.fn<() => MockQueue | null>(() => mockQueue);
vi.mock("../../../lib/queue.js", () => ({
  getQueue: () => mockGetQueue(),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { changeEmail, enqueueAccountEmailChangedNotification, ConcurrencyError } =
  await import("../../../services/account.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/email", () => {
  beforeEach(() => {
    vi.mocked(changeEmail).mockReset();
    vi.mocked(enqueueAccountEmailChangedNotification).mockReset();
    vi.mocked(enqueueAccountEmailChangedNotification).mockResolvedValue(undefined);
    mockGetQueue.mockReturnValue(mockQueue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok on successful email change (no leaked addresses)", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      kind: "changed",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 2,
    });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });

    expect(res.status).toBe(200);
    // Response body must carry { ok: true } only — the prior and new plaintext
    // addresses are intentionally private.
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body).toEqual({ data: { ok: true } });
    expect(body.data).not.toHaveProperty("oldEmail");
    expect(body.data).not.toHaveProperty("newEmail");
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(new ValidationError("Incorrect password"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "00".repeat(32) }),
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
      body: JSON.stringify({ email: "taken@example.com", authKey: "ab".repeat(32) }),
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
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("passes request body to changeEmail service", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({ kind: "noop" });

    const app = createApp();
    await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });

    expect(vi.mocked(changeEmail)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      { email: "new@example.com", authKey: "ab".repeat(32) },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test001" }),
    );
  });

  it("delegates to enqueueAccountEmailChangedNotification on kind:'changed'", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      kind: "changed",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 9,
    });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    const helper = vi.mocked(enqueueAccountEmailChangedNotification);
    expect(helper).toHaveBeenCalledTimes(1);
    expect(helper).toHaveBeenCalledWith(
      mockQueue,
      expect.any(Function),
      expect.anything(),
      expect.objectContaining({
        accountId: "acct_test001",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        version: 9,
      }),
    );
  });

  it("skips the notification helper on kind:'noop'", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({ kind: "noop" });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    expect(vi.mocked(enqueueAccountEmailChangedNotification)).not.toHaveBeenCalled();
  });

  it("passes a null queue through to the helper when getQueue returns null", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      kind: "changed",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 3,
    });
    mockGetQueue.mockReturnValueOnce(null);

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", authKey: "ab".repeat(32) }),
    });
    expect(res.status).toBe(200);

    const helper = vi.mocked(enqueueAccountEmailChangedNotification);
    expect(helper).toHaveBeenCalledTimes(1);
    expect(helper.mock.calls[0]?.[0]).toBeNull();
  });

  it("does not fail the request when the helper rejects (fire-and-forget)", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({
      kind: "changed",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 4,
    });
    vi.mocked(enqueueAccountEmailChangedNotification).mockRejectedValueOnce(
      new Error("queue down"),
    );

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
