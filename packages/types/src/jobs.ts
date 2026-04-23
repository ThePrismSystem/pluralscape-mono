import type { DeviceTokenPlatform } from "./entities/device-token.js";
import type {
  AccountId,
  DeviceTokenId,
  JobId,
  SyncDocumentId,
  SystemId,
  WebhookDeliveryId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** Template names supported by the email system (mirrors @pluralscape/email). */
export type EmailTemplateName =
  | "recovery-key-regenerated"
  | "new-device-login"
  | "password-changed"
  | "two-factor-changed"
  | "webhook-failure-digest"
  | "account-change-email";

/**
 * Runtime-visible enumeration of every supported job type.
 *
 * Expressed as a `const` tuple so it can double as a zod enum source at
 * deserialization boundaries. Keep {@link JobType} derived from this tuple —
 * a stray string literal in the type union but not in the tuple would silently
 * slip past schema validation.
 */
export const JOB_TYPE_VALUES = [
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
  "email-send",
] as const;

/** The kind of background job. */
export type JobType = (typeof JOB_TYPE_VALUES)[number];

/** Runtime-visible enumeration of every supported job status. */
export const JOB_STATUS_VALUES = [
  "pending",
  "running",
  "completed",
  "cancelled",
  "dead-letter",
] as const;

/** Current status of a background job. */
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

/** Backoff strategy for retry timing. */
export type BackoffStrategy = "exponential" | "linear";

/** Retry policy for failed jobs. */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
  /** Defaults to `"exponential"` when omitted. */
  readonly strategy?: BackoffStrategy;
  /** Fraction of jitter to apply (e.g. 0.2 = +/- 20%). Defaults to 0 (no jitter). */
  readonly jitterFraction?: number;
}

/** Maps each job type to its expected payload shape. Augment with specific types as handlers are implemented. */
export interface JobPayloadMap {
  "sync-push": Record<string, unknown>;
  "sync-pull": Record<string, unknown>;
  "blob-upload": Record<string, unknown>;
  "blob-cleanup": Record<string, never>;
  "export-generate": Record<string, unknown>;
  "import-process": Record<string, unknown>;
  "webhook-deliver": {
    readonly deliveryId: WebhookDeliveryId;
  };
  "notification-send": {
    readonly accountId: AccountId;
    readonly systemId: SystemId;
    readonly deviceTokenId: DeviceTokenId;
    readonly platform: DeviceTokenPlatform;
    readonly payload: {
      readonly title: string;
      readonly body: string;
      readonly data: Readonly<Record<string, string>> | null;
    };
  };
  "analytics-compute": Record<string, unknown>;
  "account-purge": Record<string, unknown>;
  "bucket-key-rotation": Record<string, unknown>;
  "report-generate": Record<string, unknown>;
  "sync-queue-cleanup": Record<string, never>;
  "audit-log-cleanup": Record<string, never>;
  "partition-maintenance": Record<string, unknown>;
  "sync-compaction": {
    readonly documentId: SyncDocumentId;
    readonly systemId: SystemId;
  };
  "device-transfer-cleanup": Record<string, never>;
  "check-in-generate": Record<string, never>;
  "webhook-delivery-cleanup": Record<string, never>;
  "email-send": {
    readonly accountId: AccountId;
    readonly template: EmailTemplateName;
    readonly vars: Readonly<Record<string, unknown>>;
    /**
     * Explicit recipient email that overrides the account's current address.
     *
     * Used by flows that must notify an address no longer attached to the
     * account (e.g. account-change-email sends to the OLD address after the
     * new one has already been persisted).
     *
     * `null` means "no override — resolve the account's current email".
     * The field is required (never `undefined`) so producers cannot silently
     * omit it and workers never see the empty-string footgun.
     */
    readonly recipientOverride: string | null;
  };
}

/** Result of a completed or failed job. */
export interface JobResult {
  readonly success: boolean;
  readonly message: string | null;
  readonly completedAt: UnixMillis;
}

/** Common fields shared by every job variant. */
export interface JobCommonFields {
  readonly id: JobId;
  readonly systemId: SystemId | null;
  readonly status: JobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: UnixMillis | null;
  readonly error: string | null;
  readonly result: JobResult | null;
  readonly createdAt: UnixMillis;
  readonly startedAt: UnixMillis | null;
  readonly completedAt: UnixMillis | null;
  readonly idempotencyKey: string | null;
  readonly lastHeartbeatAt: UnixMillis | null;
  /** Conservative baseline timeout in ms; job types with long-running work should override. */
  readonly timeoutMs: number;
  readonly scheduledFor: UnixMillis | null;
  /** Lower value = higher priority (0 is highest). Matches BullMQ convention. */
  readonly priority: number;
}

/**
 * A background job definition, correlated between `type` and `payload`.
 *
 * Written as a mapped-over-union so that `JobDefinition` (no generic) is the
 * *distributive* union of each per-type variant — narrowing on `type` also
 * narrows `payload` to the exact shape from `JobPayloadMap[type]`. Workers no
 * longer need unchecked casts; `if (job.type === "email-send")` is enough.
 */
export type JobDefinition<T extends JobType = JobType> = {
  [K in T]: JobCommonFields & {
    readonly type: K;
    readonly payload: Readonly<JobPayloadMap[K]>;
  };
}[T];

/**
 * Distributive union of every concrete job payload shape.
 *
 * Used by storage-layer `$type<>()` bindings (drizzle) where the sibling
 * `type` column carries the discriminator. Prefer the narrowed
 * `JobPayloadMap[SpecificType]` in worker code.
 */
export type JobPayload = JobPayloadMap[JobType];
