import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { AccountId, ApiErrorResponse, SessionId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/request-meta.js", () => ({
  extractPlatform: vi.fn().mockReturnValue("web"),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/recovery-key.service.js", () => ({
  resetPasswordWithRecoveryKey: vi.fn(),
  NoActiveRecoveryKeyError: class extends Error {
    override name = "NoActiveRecoveryKeyError" as const;
  },
  DecryptionFailedError: class extends Error {
    override name = "DecryptionFailedError" as const;
  },
  InvalidInputError: class extends Error {
    override name = "InvalidInputError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/email-hash.js", () => ({
  hashEmail: vi.fn().mockReturnValue("hashed-email"),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  ...mockRateLimitFactory(),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const {
  resetPasswordWithRecoveryKey,
  NoActiveRecoveryKeyError,
  DecryptionFailedError,
  InvalidInputError,
} = await import("../../../services/recovery-key.service.js");
const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
const { passwordResetRoute } = await import("../../../routes/auth/password-reset.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/password-reset", passwordResetRoute);

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
      sessionToken: "sess_new" as SessionId,
      recoveryKey: "NEW-RECOVERY-KEY",
      accountId: "acct_123" as AccountId,
    });

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { sessionToken: string; recoveryKey: string; accountId: string };
    };
    expect(body.data.sessionToken).toBe("sess_new");
    expect(body.data.recoveryKey).toBe("NEW-RECOVERY-KEY");
    expect(body.data.accountId).toBe("acct_123");
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

  it("returns 400 for ZodError (via global handler)", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });
    // Suppress global error handler console.warn in test output
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
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

  it("returns 401 for DecryptionFailedError (bad recovery key)", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValueOnce(
      new DecryptionFailedError("Decryption failed"),
    );

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for InvalidInputError (malformed recovery key)", async () => {
    vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValueOnce(
      new InvalidInputError("Invalid recovery key format"),
    );

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 429 when per-account recovery rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterMs: 3_000 });

    const app = createApp();
    const res = await postJSON(app, VALID_BODY);

    expect(res.status).toBe(429);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("Too many recovery attempts for this account");
  });

  it("returns 400 when email is missing from recovery request", async () => {
    const app = createApp();
    const res = await postJSON(app, { recoveryKey: "a".repeat(52) });

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
