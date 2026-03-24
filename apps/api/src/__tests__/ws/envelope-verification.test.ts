/**
 * Tests for shouldVerifyEnvelopeSignatures warning behaviour.
 *
 * The function reads VERIFY_ENVELOPE_SIGNATURES from process.env and logs
 * a one-time warning via the module-level `envelopeVerificationWarningLogged`
 * flag when verification is disabled.
 *
 * Each test uses `vi.resetModules()` so the memoisation flag resets on re-import.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("../../lib/logger.js", () => ({
  logger: {
    warn: mockWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// handlers.ts imports these — mock to prevent actual crypto initialisation
vi.mock("@pluralscape/crypto", () => ({
  getSodium: vi.fn(),
  InvalidInputError: class InvalidInputError extends Error {},
}));

vi.mock("@pluralscape/sync", () => ({
  verifyEnvelopeSignature: vi.fn(),
  EnvelopeLimitExceededError: class EnvelopeLimitExceededError extends Error {},
  SnapshotSizeLimitExceededError: class SnapshotSizeLimitExceededError extends Error {},
  SnapshotVersionConflictError: class SnapshotVersionConflictError extends Error {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Dynamically import shouldVerifyEnvelopeSignatures after env var is configured.
 * Requires vi.resetModules() to have been called first so the module-level
 * memoisation flag in handlers.ts is fresh.
 */
async function importShouldVerify(): Promise<() => boolean> {
  const mod = await import("../../ws/handlers.js");
  return mod.shouldVerifyEnvelopeSignatures;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("shouldVerifyEnvelopeSignatures — warning behaviour", () => {
  const savedEnv = process.env["VERIFY_ENVELOPE_SIGNATURES"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env["VERIFY_ENVELOPE_SIGNATURES"];
    } else {
      process.env["VERIFY_ENVELOPE_SIGNATURES"] = savedEnv;
    }
    vi.restoreAllMocks();
  });

  it("returns true and does not log a warning when env var is not set", async () => {
    delete process.env["VERIFY_ENVELOPE_SIGNATURES"];

    const shouldVerify = await importShouldVerify();

    expect(shouldVerify()).toBe(true);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("returns false and logs a warning when VERIFY_ENVELOPE_SIGNATURES=false", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

    const shouldVerify = await importShouldVerify();

    expect(shouldVerify()).toBe(false);
    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("VERIFY_ENVELOPE_SIGNATURES is disabled"),
    );
  });

  it("logs the warning only once across multiple calls (memoisation)", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

    const shouldVerify = await importShouldVerify();

    shouldVerify();
    shouldVerify();
    shouldVerify();

    expect(mockWarn).toHaveBeenCalledOnce();
  });

  it("returns false and logs a warning when VERIFY_ENVELOPE_SIGNATURES=0", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "0";

    const shouldVerify = await importShouldVerify();

    expect(shouldVerify()).toBe(false);
    expect(mockWarn).toHaveBeenCalledOnce();
  });

  it("returns true and does not log a warning when VERIFY_ENVELOPE_SIGNATURES=true", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "true";

    const shouldVerify = await importShouldVerify();

    expect(shouldVerify()).toBe(true);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("warning message includes hint about E2E encryption integrity", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

    const shouldVerify = await importShouldVerify();
    shouldVerify();

    const [warningMessage] = mockWarn.mock.calls[0] as [string];
    expect(warningMessage).toContain("E2E encryption integrity");
  });
});
