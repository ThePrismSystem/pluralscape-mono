import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, BiometricTokenId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/biometric.service.js", () => ({
  enrollBiometric: vi.fn(),
  verifyBiometric: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { enrollBiometric, verifyBiometric } = await import("../../../services/biometric.service.js");
const { biometricRoute } = await import("../../../routes/auth/biometric.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/biometric", biometricRoute);

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
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("bt_test123");
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
    const body = (await res.json()) as { data: { verified: boolean } };
    expect(body.data.verified).toBe(true);
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
