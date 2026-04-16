/**
 * Tests for shouldVerifyEnvelopeSignatures warning behaviour.
 *
 * The function reads VERIFY_ENVELOPE_SIGNATURES from process.env once at module
 * load via an IIFE and logs a warning when verification is disabled.
 *
 * Each test uses `vi.resetModules()` so the IIFE re-evaluates on re-import.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Dynamically import shouldVerifyEnvelopeSignatures after env var is configured.
 * Requires vi.resetModules() to have been called first so the IIFE in
 * envelope-verification-config.ts re-evaluates with the new env.
 */
async function importShouldVerify(): Promise<() => boolean> {
  const mod = await import("../../ws/envelope-verification-config.js");
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

  it("returns the cached value across multiple calls (IIFE evaluates once)", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

    const shouldVerify = await importShouldVerify();

    shouldVerify();
    shouldVerify();
    shouldVerify();

    // Warning is logged once by the IIFE, not per call
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
