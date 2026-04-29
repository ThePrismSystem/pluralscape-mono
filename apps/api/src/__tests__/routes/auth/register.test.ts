import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/request-meta.js", () => ({
  extractPlatform: vi.fn().mockReturnValue("web"),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/auth/register.js", () => ({
  initiateRegistration: vi.fn(),
  commitRegistration: vi.fn(),
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/idempotency.js", () => ({
  createIdempotencyMiddleware: () =>
    vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));
// ── Imports after mocks ──────────────────────────────────────────

const { initiateRegistration, commitRegistration, ValidationError } =
  await import("../../../services/auth/register.js");
const { registerRoute } = await import("../../../routes/auth/register.js");
const { authRoutes } = await import("../../../routes/auth/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/register", registerRoute);
const createAuthApp = () => createRouteApp("/auth", authRoutes);

const VALID_INITIATE_BODY = {
  email: "test@example.com",
};

const VALID_COMMIT_BODY = {
  accountId: "acct_123",
  authKey: "ab".repeat(32),
  encryptedMasterKey: "cd".repeat(48),
  encryptedSigningPrivateKey: "cd".repeat(48),
  encryptedEncryptionPrivateKey: "cd".repeat(48),
  publicSigningKey: "ef".repeat(32),
  publicEncryptionKey: "ef".repeat(32),
  recoveryEncryptedMasterKey: "cd".repeat(48),
  challengeSignature: "ab".repeat(64),
  recoveryKeyBackupConfirmed: true,
  recoveryKeyHash: "11".repeat(32),
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /register/initiate", () => {
  beforeEach(() => {
    vi.mocked(initiateRegistration).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with registration initiate data on success", async () => {
    vi.mocked(initiateRegistration).mockResolvedValueOnce({
      accountId: "acct_123",
      kdfSalt: "aa".repeat(16),
      challengeNonce: "bb".repeat(32),
    });

    const app = createApp();
    const res = await postJSON(app, "/register/initiate", VALID_INITIATE_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { accountId: string; kdfSalt: string; challengeNonce: string };
    };
    expect(body.data.accountId).toBe("acct_123");
    expect(body.data.kdfSalt).toBe("aa".repeat(16));
    expect(body.data.challengeNonce).toBe("bb".repeat(32));
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/register/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });
});

describe("POST /register/commit", () => {
  beforeEach(() => {
    vi.mocked(commitRegistration).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with session data on successful commit", async () => {
    vi.mocked(commitRegistration).mockResolvedValueOnce({
      sessionToken: "tok_abc",
      accountId: "acct_123",
      accountType: "system",
    });

    const app = createApp();
    const res = await postJSON(app, "/register/commit", VALID_COMMIT_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { sessionToken: string; accountId: string; accountType: string };
    };
    expect(body.data.sessionToken).toBe("tok_abc");
    expect(body.data.accountId).toBe("acct_123");
    expect(body.data.accountType).toBe("system");
  });

  it("returns 400 VALIDATION_ERROR when commitRegistration throws ValidationError", async () => {
    vi.mocked(commitRegistration).mockRejectedValueOnce(
      new ValidationError("Recovery key backup must be confirmed"),
    );

    const app = createApp();
    const res = await postJSON(app, "/register/commit", VALID_COMMIT_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Recovery key backup must be confirmed");
  });

  it("returns 400 VALIDATION_ERROR when commitRegistration throws ZodError (via global handler)", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.mocked(commitRegistration).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, "/register/commit", VALID_COMMIT_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(commitRegistration).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/register/commit", VALID_COMMIT_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  describe("Cache-Control", () => {
    it("sets Cache-Control: no-store on successful commit", async () => {
      vi.mocked(commitRegistration).mockResolvedValueOnce({
        sessionToken: "tok_cc",
        accountId: "acct_cc",
        accountType: "system",
      });

      const app = createAuthApp();
      const res = await postJSON(app, "/auth/register/commit", VALID_COMMIT_BODY);

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
