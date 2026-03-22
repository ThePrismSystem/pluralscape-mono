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

  it("returns base delay for first retry", () => {
    expect(calculateBackoffMs(1, baseMs)).toBe(2000);
  });

  it("doubles delay for each subsequent retry", () => {
    expect(calculateBackoffMs(2, baseMs)).toBe(4000);
    expect(calculateBackoffMs(3, baseMs)).toBe(8000);
    expect(calculateBackoffMs(4, baseMs)).toBe(16000);
  });

  it("returns base for attempt 0", () => {
    expect(calculateBackoffMs(0, baseMs)).toBe(1000);
  });
});

describe("WEBHOOK_SIGNATURE_HEADER", () => {
  it("has the correct header name", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Pluralscape-Signature");
  });
});
