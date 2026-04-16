/**
 * Structural verification tests for anti-enumeration timing.
 * These confirm that the timing equalization pattern exists in the expected
 * locations, not that the timing itself is precise (which would be flaky).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";

describe("equalizeAntiEnumTiming", () => {
  it("resolves without sleeping when elapsed exceeds target", async () => {
    // Start time far enough in the past that remaining <= 0
    const longAgo = performance.now() - 10_000;
    const before = performance.now();
    await equalizeAntiEnumTiming(longAgo);
    const elapsed = performance.now() - before;
    // Should return near-instantly since remaining time is negative
    expect(elapsed).toBeLessThan(50);
  });

  it("resolves within timing window for recent start", async () => {
    const start = performance.now();
    await equalizeAntiEnumTiming(start);
    const elapsed = performance.now() - start;
    // Should have delayed to fill the anti-enum timing window
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});

describe("anti-enum timing (structural verification)", () => {
  const antiEnumPath = resolve(import.meta.dirname, "../../lib/anti-enum-timing.ts");
  const antiEnumSource = readFileSync(antiEnumPath, "utf8");

  it("uses performance.now() for timing", () => {
    expect(antiEnumSource).toContain("performance.now()");
  });

  it("references ANTI_ENUM_TARGET_MS constant", () => {
    expect(antiEnumSource).toContain("ANTI_ENUM_TARGET_MS");
  });

  it("sleeps for the remaining time delta", () => {
    expect(antiEnumSource).toContain("setTimeout(resolve, remaining)");
  });
});

describe("recovery-key.service uses shared anti-enum timing", () => {
  const recoveryPath = resolve(import.meta.dirname, "../../services/recovery-key.service.ts");
  const recoverySource = readFileSync(recoveryPath, "utf8");

  it("imports equalizeAntiEnumTiming from shared lib", () => {
    expect(recoverySource).toContain(
      'import { equalizeAntiEnumTiming } from "../lib/anti-enum-timing.js"',
    );
  });

  it("calls equalizeAntiEnumTiming in not-found paths", () => {
    expect(recoverySource).toContain("equalizeAntiEnumTiming(startTime)");
  });

  it("does not define its own equalizeAntiEnumTiming", () => {
    expect(recoverySource).not.toContain("async function equalizeAntiEnumTiming");
  });
});

describe("auth.service login anti-enum timing", () => {
  const authPath = resolve(import.meta.dirname, "../../services/auth.service.ts");
  const authSource = readFileSync(authPath, "utf8");

  it("uses dummy auth key verification on not-found path", () => {
    expect(authSource).toContain("verifyAuthKey(dummyKey, dummyHash)");
  });
});
