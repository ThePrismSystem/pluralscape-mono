import type { JobType, RetryPolicy } from "@pluralscape/types";

/** Fallback retry policy used when no per-type policy is configured. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
  jitterFraction: 0.2,
};

/** Shared policy for heavy background maintenance jobs (5min base, 30min cap). */
const HEAVY_BACKOFF: RetryPolicy = {
  maxRetries: 2,
  backoffMs: 300_000,
  backoffMultiplier: 5,
  maxBackoffMs: 1_800_000,
  strategy: "exponential",
  jitterFraction: 0.2,
};

/**
 * Default retry policies for all job types.
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
    jitterFraction: 0.2,
  },
  "sync-pull": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "blob-upload": {
    maxRetries: 3,
    backoffMs: 2_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "blob-cleanup": HEAVY_BACKOFF,
  "export-generate": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "import-process": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "webhook-deliver": {
    maxRetries: 5,
    backoffMs: 30_000,
    backoffMultiplier: 4,
    maxBackoffMs: 7_200_000, // 2 hours
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "notification-send": {
    maxRetries: 3,
    backoffMs: 5_000,
    backoffMultiplier: 1,
    maxBackoffMs: 30_000,
    strategy: "linear",
    jitterFraction: 0.2,
  },
  "analytics-compute": HEAVY_BACKOFF,
  "account-purge": { ...HEAVY_BACKOFF, maxRetries: 3, backoffMs: 60_000, jitterFraction: 0.2 },
  "bucket-key-rotation": HEAVY_BACKOFF,
  "report-generate": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 4,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "sync-queue-cleanup": HEAVY_BACKOFF,
  "audit-log-cleanup": HEAVY_BACKOFF,
  "partition-maintenance": HEAVY_BACKOFF,
  "sync-compaction": {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "device-transfer-cleanup": {
    maxRetries: 3,
    backoffMs: 10_000,
    backoffMultiplier: 2,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "check-in-generate": {
    maxRetries: 3,
    backoffMs: 5_000,
    backoffMultiplier: 2,
    maxBackoffMs: 60_000,
    strategy: "exponential",
    jitterFraction: 0.2,
  },
  "webhook-delivery-cleanup": HEAVY_BACKOFF,
};
