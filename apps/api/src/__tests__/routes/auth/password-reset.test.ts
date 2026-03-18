import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/request-meta.js", () => ({
  extractPlatform: vi.fn().mockReturnValue("web"),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../services/recovery-key.service.js", () => ({
  resetPasswordWithRecoveryKey: vi.fn(),
  NoActiveRecoveryKeyError: class extends Error {
    override name = "NoActiveRecoveryKeyError" as const;
  },
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

// ── Imports after mocks ──────────────────────────────────────────

const { resetPasswordWithRecoveryKey, NoActiveRecoveryKeyError } =
  await import("../../../services/recovery-key.service.js");
const { passwordResetRoute } = await import("../../../routes/auth/password-reset.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/password-reset", passwordResetRoute);
  app.onError(errorHandler);
  return app;
}

async function postJSON(app: Hono, body: unknown): Promise<Response> {
  return await app.request("/password-reset/recovery-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  email: "test@example.com",
  recoveryKey: "ABCD-EFGH-IJKL-MNOP",
  newPassword: "newstrongpassword123",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /password-reset/recovery-key", () => {
  beforeEach(() => {
    vi.mocked(resetPasswordWithRecoveryKey).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with session data on successful reset", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockResolvedValueOnce({
      sessionToken: "sess_new",
      recoveryKey: "NEW-RECOVERY-KEY",
      accountId: "acct_123",
    });

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionToken: string;
      recoveryKey: string;
      accountId: string;
    };
    expect(body.sessionToken).toBe("sess_new");
    expect(body.recoveryKey).toBe("NEW-RECOVERY-KEY");
    expect(body.accountId).toBe("acct_123");
  });

  it("returns 401 when account not found (anti-enumeration)", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid email or recovery key");
  });

  it("returns 401 when no active recovery key", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValueOnce(
      new NoActiveRecoveryKeyError("No active recovery key found"),
    );

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 400 for invalid input", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });
    vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON", async () => {
    const app = createApp();
    const res = await app.request("/password-reset/recovery-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(500);
  });
});
