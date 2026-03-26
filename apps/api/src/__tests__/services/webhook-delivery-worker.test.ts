import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  WEBHOOK_MAX_RETRY_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../../service.constants.js";
import {
  calculateBackoffMs,
  computeWebhookSignature,
  findPendingDeliveries,
  processWebhookDelivery,
} from "../../services/webhook-delivery-worker.js";
import { mockDb } from "../helpers/mock-db.js";

import type { WebhookDeliveryId } from "@pluralscape/types";

vi.mock("../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../../lib/ip-validation.js", () => ({
  resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
}));

// ── Tests ────────────────────────────────────────────────────────

describe("computeWebhookSignature", () => {
  it("produces a consistent HMAC-SHA256 hex signature", () => {
    const secret = Buffer.from("test-secret-key");
    const timestamp = 1700000000;
    const payload = '{"event":"member.created"}';

    const sig1 = computeWebhookSignature(secret, timestamp, payload);
    const sig2 = computeWebhookSignature(secret, timestamp, payload);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different signatures for different payloads", () => {
    const secret = Buffer.from("test-secret-key");
    const timestamp = 1700000000;

    const sig1 = computeWebhookSignature(secret, timestamp, '{"a":1}');
    const sig2 = computeWebhookSignature(secret, timestamp, '{"a":2}');

    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different secrets", () => {
    const timestamp = 1700000000;
    const payload = '{"event":"test"}';

    const sig1 = computeWebhookSignature(Buffer.from("key-1"), timestamp, payload);
    const sig2 = computeWebhookSignature(Buffer.from("key-2"), timestamp, payload);

    expect(sig1).not.toBe(sig2);
  });

  it("includes the timestamp in the HMAC computation", () => {
    const secret = Buffer.from("test-secret-key");
    const payload = '{"event":"test"}';

    const sig = computeWebhookSignature(secret, 1700000000, payload);

    // Manually compute expected: HMAC of "1700000000.{payload}"
    const expected = createHmac("sha256", secret).update(`1700000000.${payload}`).digest("hex");

    expect(sig).toBe(expected);
  });

  it("produces different signatures when timestamp changes", () => {
    const secret = Buffer.from("test-secret-key");
    const payload = '{"event":"test"}';

    const sig1 = computeWebhookSignature(secret, 1700000000, payload);
    const sig2 = computeWebhookSignature(secret, 1700000001, payload);

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

describe("webhook header constants", () => {
  it("WEBHOOK_SIGNATURE_HEADER has the correct header name", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Pluralscape-Signature");
  });

  it("WEBHOOK_TIMESTAMP_HEADER has the correct header name", () => {
    expect(WEBHOOK_TIMESTAMP_HEADER).toBe("X-Pluralscape-Timestamp");
  });
});

// ── Fixtures ──────────────────────────────────────────────────────

/** Joined delivery + config row returned by the single LEFT JOIN query. */
const JOINED_ROW = {
  id: "wd_test-delivery",
  webhookId: "wh_test-config",
  systemId: "sys_test-system",
  eventType: "fronting.started",
  attemptCount: 0,
  configUrl: "https://example.com/webhook",
  configSecret: "dGVzdC1zZWNyZXQta2V5",
  configEnabled: true,
};

// ── processWebhookDelivery ────────────────────────────────────────

describe("processWebhookDelivery (unit)", () => {
  it("returns early when delivery not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await processWebhookDelivery(db, "wd_missing" as WebhookDeliveryId, {});

    expect(chain.update).not.toHaveBeenCalled();
  });

  it("marks as failed when config not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      { ...JOINED_ROW, configUrl: null, configSecret: null, configEnabled: null },
    ]);

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {});

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("marks as failed when config is disabled", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW, configEnabled: false }]);

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {});

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("calls fetch with correct URL and payload on success", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    // Bun's fetch includes a static `preconnect` method that vi.fn() can't satisfy
    await processWebhookDelivery(
      db,
      "wd_test" as WebhookDeliveryId,
      { event: "test" },
      mockFetch as never,
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0] ?? [];
    const [url, options] = call as [string, RequestInit];
    expect(url).toBe("https://example.com/webhook");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ event: "test" }));
  });

  it("sends correct headers (Content-Type, Signature, Timestamp)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    await processWebhookDelivery(
      db,
      "wd_test" as WebhookDeliveryId,
      { event: "test" },
      mockFetch as never,
    );

    const call = mockFetch.mock.calls[0] ?? [];
    const options = call[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers[WEBHOOK_TIMESTAMP_HEADER]).toMatch(/^\d+$/);
  });

  it("marks as success on 2xx response", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never);

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("schedules retry on non-2xx when under max attempts", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW, attemptCount: 0 }]);

    const mockFetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never);

    const setCall = chain.set.mock.calls[0] ?? [];
    const setArg = setCall[0] as Record<string, unknown>;
    expect(setArg.httpStatus).toBe(500);
    expect(setArg.nextRetryAt).toBeDefined();
    expect(setArg.status).toBeUndefined();
  });

  it("marks as failed when max retries exceeded", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      { ...JOINED_ROW, attemptCount: WEBHOOK_MAX_RETRY_ATTEMPTS - 1 },
    ]);

    const mockFetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never);

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("handles TypeError (network error) without rethrowing", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never);

    const setCall = chain.set.mock.calls[0] ?? [];
    const setArg = setCall[0] as Record<string, unknown>;
    expect(setArg.httpStatus).toBeNull();
  });

  it("handles AbortError (timeout) without rethrowing", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const abortErr = new DOMException("The operation was aborted", "AbortError");
    const mockFetch = vi.fn().mockRejectedValue(abortErr);

    await processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never);

    const setCall = chain.set.mock.calls[0] ?? [];
    const setArg = setCall[0] as Record<string, unknown>;
    expect(setArg.httpStatus).toBeNull();
  });

  it("rethrows unexpected errors", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ ...JOINED_ROW }]);

    const mockFetch = vi.fn().mockRejectedValue(new Error("unexpected"));

    await expect(
      processWebhookDelivery(db, "wd_test" as WebhookDeliveryId, {}, mockFetch as never),
    ).rejects.toThrow("unexpected");
  });
});

// ── findPendingDeliveries ─────────────────────────────────────────

describe("findPendingDeliveries (unit)", () => {
  it("passes limit to the query", async () => {
    const { db, chain } = mockDb();
    const TEST_LIMIT = 25;

    await findPendingDeliveries(db, TEST_LIMIT);

    expect(chain.limit).toHaveBeenCalledWith(TEST_LIMIT);
  });

  it("returns the query result", async () => {
    const { db, chain } = mockDb();
    const mockResults = [
      {
        id: "wd_1",
        webhookId: "wh_1",
        systemId: "sys_1",
        eventType: "fronting.started",
      },
    ];
    chain.limit.mockResolvedValueOnce(mockResults);

    const result = await findPendingDeliveries(db, 10);

    expect(result).toEqual(mockResults);
  });
});
