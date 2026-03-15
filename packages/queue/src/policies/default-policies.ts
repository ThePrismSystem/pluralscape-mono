import type { JobType, RetryPolicy } from "@pluralscape/types";

/** Fallback retry policy used when no per-type policy is configured. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
};

/**
 * Default retry policies for all 15 job types.
 *
 * Keys are typed as `Record<JobType, RetryPolicy>` to guarantee
 * compile-time coverage when new job types are added.
 */
export const DEFAULT_RETRY_POLICIES: Readonly<Record<JobType, RetryPolicy>> = {
  "sync-push": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
    strategy: "exponential",
  },
  "sync-pull": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
    strategy: "exponential",
  },
  "blob-upload": {
    maxRetries: 3,
    backoffMs: 2_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
  },
  "blob-cleanup": {
    maxRetries: 2,
    backoffMs: 300_000, // 5 minutes
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000, // 30 minutes
    strategy: "exponential",
  },
  "export-generate": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
  },
  "import-process": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
  },
  "webhook-deliver": {
    maxRetries: 5,
    backoffMs: 30_000,
    backoffMultiplier: 4,
    maxBackoffMs: 7_200_000, // 2 hours
    strategy: "exponential",
  },
  "notification-send": {
    maxRetries: 3,
    backoffMs: 5_000,
    backoffMultiplier: 1,
    maxBackoffMs: 30_000,
    strategy: "linear",
  },
  "analytics-compute": {
    maxRetries: 2,
    backoffMs: 300_000,
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
  "account-purge": {
    maxRetries: 3,
    backoffMs: 60_000, // 1 minute
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
  "bucket-key-rotation": {
    maxRetries: 2,
    backoffMs: 300_000,
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
  "report-generate": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
  },
  "sync-queue-cleanup": {
    maxRetries: 2,
    backoffMs: 300_000,
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
  "audit-log-cleanup": {
    maxRetries: 2,
    backoffMs: 300_000,
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
  "partition-maintenance": {
    maxRetries: 2,
    backoffMs: 300_000,
    backoffMultiplier: 5,
    maxBackoffMs: 1_800_000,
    strategy: "exponential",
  },
};
