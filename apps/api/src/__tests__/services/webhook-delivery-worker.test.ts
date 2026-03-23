import { describe, expect, it } from "vitest";

import {
  calculateBackoffMs,
  computeWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "../../services/webhook-delivery-worker.js";

// ── Tests ────────────────────────────────────────────────────────

describe("computeWebhookSignature", () => {
  it("produces a consistent HMAC-SHA256 hex signature", () => {
    const secret = Buffer.from("test-secret-key");
    const payload = '{"event":"member.created"}';

    const sig1 = computeWebhookSignature(secret, payload);
    const sig2 = computeWebhookSignature(secret, payload);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different signatures for different payloads", () => {
    const secret = Buffer.from("test-secret-key");

    const sig1 = computeWebhookSignature(secret, '{"a":1}');
    const sig2 = computeWebhookSignature(secret, '{"a":2}');

    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different secrets", () => {
    const payload = '{"event":"test"}';

    const sig1 = computeWebhookSignature(Buffer.from("key-1"), payload);
    const sig2 = computeWebhookSignature(Buffer.from("key-2"), payload);

    expect(sig1).not.toBe(sig2);
  });
});

describe("calculateBackoffMs", () => {
  const baseMs = 1000;

  it("returns exact delay when jitter is disabled", () => {
    expect(calculateBackoffMs(0, baseMs, 0)).toBe(1000);
    expect(calculateBackoffMs(1, baseMs, 0)).toBe(2000);
    expect(calculateBackoffMs(2, baseMs, 0)).toBe(4000);
    expect(calculateBackoffMs(3, baseMs, 0)).toBe(8000);
    expect(calculateBackoffMs(4, baseMs, 0)).toBe(16000);
  });

  it("applies jitter within expected range with default fraction", () => {
    const attempts = 100;
    const results: number[] = [];
    for (let i = 0; i < attempts; i++) {
      results.push(calculateBackoffMs(2, baseMs));
    }

    const expectedBase = 4000;
    const minExpected = expectedBase * 0.75; // -25%
    const maxExpected = expectedBase * 1.25; // +25%

    for (const result of results) {
      expect(result).toBeGreaterThanOrEqual(minExpected);
      expect(result).toBeLessThanOrEqual(maxExpected);
    }
  });

  it("returns non-negative value for attempt 0", () => {
    expect(calculateBackoffMs(0, baseMs, 0)).toBe(1000);
  });
});

describe("WEBHOOK_SIGNATURE_HEADER", () => {
  it("has the correct header name", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Pluralscape-Signature");
  });
});
