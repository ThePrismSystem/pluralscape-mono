import { describe, expect, it, vi } from "vitest";

import { DEFAULT_RETRY_POLICIES } from "../policies/default-policies.js";
import { applyDefaultPolicies } from "../policies/policy-registry.js";

import { InMemoryJobQueue } from "./mock-queue.js";

import type { JobType, Logger } from "@pluralscape/types";

const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** All job types — must match the JobType union exactly. */
const ALL_JOB_TYPES: readonly JobType[] = [
  "sync-push",
  "sync-pull",
  "blob-upload",
  "blob-cleanup",
  "export-generate",
  "import-process",
  "webhook-deliver",
  "notification-send",
  "analytics-compute",
  "account-purge",
  "bucket-key-rotation",
  "report-generate",
  "sync-queue-cleanup",
  "audit-log-cleanup",
  "partition-maintenance",
  "sync-compaction",
  "device-transfer-cleanup",
  "check-in-generate",
  "webhook-delivery-cleanup",
] as const;

describe("DEFAULT_RETRY_POLICIES", () => {
  it("has an entry for every JobType", () => {
    const policyKeys = Object.keys(DEFAULT_RETRY_POLICIES);
    for (const type of ALL_JOB_TYPES) {
      expect(policyKeys).toContain(type);
    }
    expect(policyKeys).toHaveLength(ALL_JOB_TYPES.length);
  });

  it("every policy has valid numeric fields", () => {
    for (const [type, policy] of Object.entries(DEFAULT_RETRY_POLICIES)) {
      expect(policy.maxRetries, `${type}.maxRetries`).toBeGreaterThan(0);
      expect(policy.backoffMs, `${type}.backoffMs`).toBeGreaterThan(0);
      expect(policy.backoffMultiplier, `${type}.backoffMultiplier`).toBeGreaterThanOrEqual(1);
      expect(policy.maxBackoffMs, `${type}.maxBackoffMs`).toBeGreaterThanOrEqual(policy.backoffMs);
    }
  });

  it("every policy has an explicit strategy", () => {
    for (const [type, policy] of Object.entries(DEFAULT_RETRY_POLICIES)) {
      expect(policy.strategy, `${type}.strategy`).toMatch(/^(exponential|linear)$/);
    }
  });

  it("every policy has jitterFraction 0.2", () => {
    for (const [type, policy] of Object.entries(DEFAULT_RETRY_POLICIES)) {
      expect(policy.jitterFraction, `${type}.jitterFraction`).toBe(0.2);
    }
  });

  it("notification-send uses linear strategy", () => {
    expect(DEFAULT_RETRY_POLICIES["notification-send"].strategy).toBe("linear");
  });

  it("webhook-deliver has 5 max retries and 2h max backoff", () => {
    const webhook = DEFAULT_RETRY_POLICIES["webhook-deliver"];
    expect(webhook.maxRetries).toBe(5);
    expect(webhook.maxBackoffMs).toBe(7_200_000);
  });
});

describe("applyDefaultPolicies", () => {
  it("sets all 19 policies on the queue", () => {
    const queue = new InMemoryJobQueue(mockLogger);
    applyDefaultPolicies(queue);

    for (const type of ALL_JOB_TYPES) {
      const policy = queue.getRetryPolicy(type);
      expect(policy).toEqual(DEFAULT_RETRY_POLICIES[type]);
    }
  });
});
