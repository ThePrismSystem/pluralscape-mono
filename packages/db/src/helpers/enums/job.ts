/**
 * Job const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import { type JobStatus, type JobType } from "@pluralscape/types";

export const JOB_TYPES = [
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
  "audit-log-cleanup",
  "partition-maintenance",
  "device-transfer-cleanup",
  "sync-queue-cleanup",
  "sync-compaction",
  "check-in-generate",
] as const satisfies readonly JobType[];

export const JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "cancelled",
  "dead-letter",
] as const satisfies readonly JobStatus[];
