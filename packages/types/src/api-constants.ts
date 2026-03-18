/**
 * Concrete API operational constants.
 *
 * These values are the single source of truth for the numbers defined in
 * docs/planning/api-specification.md. Import them in implementation code
 * rather than hard-coding magic numbers.
 */

import type { BlobPurpose } from "./blob.js";

// ── Time & size units ────────────────────────────────────────────────

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

// ── Named duration/size constants ────────────────────────────────────
// Pre-computed to avoid magic-number lint warnings.

/** 5 minutes in milliseconds. */
const FIVE_MINUTES_MS = 300_000;
/** 7 days in milliseconds. */
const SEVEN_DAYS_MS = 604_800_000;
/** 30 days in milliseconds. Exceeds 2^31-1 — do NOT pass to `setTimeout`/`setInterval`. */
const THIRTY_DAYS_MS = 2_592_000_000;
/** 90 days in milliseconds. Exceeds 2^31-1 — do NOT pass to `setTimeout`/`setInterval`. */
const NINETY_DAYS_MS = 7_776_000_000;

/** 5 MiB in bytes. */
const FIVE_MiB = 5_242_880;
/** 10 MiB in bytes. */
const TEN_MiB = 10_485_760;
/** 25 MiB in bytes. */
const TWENTY_FIVE_MiB = 26_214_400;
/** 500 MiB in bytes. */
const FIVE_HUNDRED_MiB = 524_288_000;

// ── Rate Limits ──────────────────────────────────────────────────────

export interface RateLimitConfig {
  readonly limit: number;
  readonly windowMs: number;
}

const RATE_LIMIT_GLOBAL = 100;
const RATE_LIMIT_AUTH_HEAVY = 5;
const RATE_LIMIT_AUTH_LIGHT = 20;
const RATE_LIMIT_DEVICE_TRANSFER = 10;
const RATE_LIMIT_WRITE = 60;
const RATE_LIMIT_READ_DEFAULT = 60;
const RATE_LIMIT_READ_HEAVY = 30;
const RATE_LIMIT_BLOB_UPLOAD = 20;
const RATE_LIMIT_WEBHOOK = 20;
const RATE_LIMIT_EXPORT_IMPORT = 2;
const RATE_LIMIT_PURGE = 1;
const RATE_LIMIT_AUDIT_QUERY = 30;
const RATE_LIMIT_FRIEND_CODE = 10;
const RATE_LIMIT_PUBLIC_API = 60;

export const RATE_LIMITS = {
  global: { limit: RATE_LIMIT_GLOBAL, windowMs: MS_PER_MINUTE },
  authHeavy: { limit: RATE_LIMIT_AUTH_HEAVY, windowMs: MS_PER_MINUTE },
  authLight: { limit: RATE_LIMIT_AUTH_LIGHT, windowMs: MS_PER_MINUTE },
  deviceTransfer: { limit: RATE_LIMIT_DEVICE_TRANSFER, windowMs: MS_PER_MINUTE },
  write: { limit: RATE_LIMIT_WRITE, windowMs: MS_PER_MINUTE },
  readDefault: { limit: RATE_LIMIT_READ_DEFAULT, windowMs: MS_PER_MINUTE },
  readHeavy: { limit: RATE_LIMIT_READ_HEAVY, windowMs: MS_PER_MINUTE },
  blobUpload: { limit: RATE_LIMIT_BLOB_UPLOAD, windowMs: MS_PER_MINUTE },
  webhookManagement: { limit: RATE_LIMIT_WEBHOOK, windowMs: MS_PER_MINUTE },
  dataExport: { limit: RATE_LIMIT_EXPORT_IMPORT, windowMs: MS_PER_HOUR },
  dataImport: { limit: RATE_LIMIT_EXPORT_IMPORT, windowMs: MS_PER_HOUR },
  accountPurge: { limit: RATE_LIMIT_PURGE, windowMs: MS_PER_DAY },
  auditQuery: { limit: RATE_LIMIT_AUDIT_QUERY, windowMs: MS_PER_MINUTE },
  friendCodeGeneration: { limit: RATE_LIMIT_FRIEND_CODE, windowMs: MS_PER_MINUTE },
  publicApi: { limit: RATE_LIMIT_PUBLIC_API, windowMs: MS_PER_MINUTE },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitCategory = keyof typeof RATE_LIMITS;

// ── Error Codes ──────────────────────────────────────────────────────

export const API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_CURSOR: "INVALID_CURSOR",
  INVALID_FRIEND_CODE: "INVALID_FRIEND_CODE",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  KEY_VERSION_STALE: "KEY_VERSION_STALE",
  FORBIDDEN: "FORBIDDEN",
  SCOPE_INSUFFICIENT: "SCOPE_INSUFFICIENT",
  BUCKET_ACCESS_DENIED: "BUCKET_ACCESS_DENIED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  HAS_DEPENDENTS: "HAS_DEPENDENTS",
  ROTATION_IN_PROGRESS: "ROTATION_IN_PROGRESS",
  FRIEND_CODE_EXPIRED: "FRIEND_CODE_EXPIRED",
  BIOMETRIC_DISABLED: "BIOMETRIC_DISABLED",
  INVALID_TOKEN: "INVALID_TOKEN",
  INVALID_PIN: "INVALID_PIN",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",
  BLOB_TOO_LARGE: "BLOB_TOO_LARGE",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ── Pagination ───────────────────────────────────────────────────────

const PAGINATION_DEFAULT_LIMIT = 25;
const PAGINATION_MAX_LIMIT = 100;
const PAGINATION_MAX_OFFSET = 10_000;

export const PAGINATION = {
  defaultLimit: PAGINATION_DEFAULT_LIMIT,
  maxLimit: PAGINATION_MAX_LIMIT,
  maxOffset: PAGINATION_MAX_OFFSET,
  cursorTtlMs: MS_PER_DAY,
  totalCountMaxRows: 100_000,
} as const;

// ── Session Timeouts ─────────────────────────────────────────────────

export const SESSION_TIMEOUTS = {
  web: {
    absoluteTtlMs: THIRTY_DAYS_MS,
    idleTimeoutMs: SEVEN_DAYS_MS,
  },
  mobile: {
    absoluteTtlMs: NINETY_DAYS_MS,
    idleTimeoutMs: THIRTY_DAYS_MS,
  },
  deviceTransfer: {
    absoluteTtlMs: FIVE_MINUTES_MS,
    idleTimeoutMs: null,
  },
} as const;

/** Minimum staleness before updating lastActive timestamp (prevents write amplification). */
export const LAST_ACTIVE_THROTTLE_MS = MS_PER_MINUTE;

// ── Media Upload Quotas ──────────────────────────────────────────────

/** Per-purpose maximum file size in bytes, keyed by BlobPurpose. */
export const BLOB_SIZE_LIMITS = {
  avatar: FIVE_MiB,
  "member-photo": TEN_MiB,
  "journal-image": TEN_MiB,
  attachment: TWENTY_FIVE_MiB,
  export: FIVE_HUNDRED_MiB,
  "littles-safe-mode": FIVE_MiB,
} as const satisfies Readonly<Record<BlobPurpose, number>>;

// ── Friend Codes ─────────────────────────────────────────────────────

const FRIEND_CODE_MAX_ACTIVE = 10;

export const FRIEND_CODE = {
  standardTtlMs: MS_PER_DAY,
  standardMaxTtlMs: SEVEN_DAYS_MS,
  extendedTtlMs: SEVEN_DAYS_MS,
  extendedMaxTtlMs: THIRTY_DAYS_MS,
  permanentTtlMs: null,
  maxActivePerSystem: FRIEND_CODE_MAX_ACTIVE,
} as const;

// ── Audit Log Retention ──────────────────────────────────────────────

const RETENTION_HOT_DAYS = 90;
const RETENTION_MIN_DAYS = 30;
const RETENTION_MAX_QUERY_DAYS = 90;
const RETENTION_WEBHOOK_DAYS = 30;
const RETENTION_DLQ_DAYS = 30;

export const AUDIT_RETENTION = {
  hostedHotRetentionDays: RETENTION_HOT_DAYS,
  selfHostedMinRetentionDays: RETENTION_MIN_DAYS,
  maxQueryRangeDays: RETENTION_MAX_QUERY_DAYS,
  webhookDeliveryRetentionDays: RETENTION_WEBHOOK_DAYS,
  dlqRetentionDays: RETENTION_DLQ_DAYS,
} as const;

// ── Key Rotation ────────────────────────────────────────────────

const KEY_ROTATION_DEFAULT_CHUNK_SIZE = 50;
const KEY_ROTATION_MAX_CHUNK_SIZE = 200;
const KEY_ROTATION_MAX_ITEM_ATTEMPTS = 3;

export const KEY_ROTATION = {
  defaultChunkSize: KEY_ROTATION_DEFAULT_CHUNK_SIZE,
  maxChunkSize: KEY_ROTATION_MAX_CHUNK_SIZE,
  staleClaimTimeoutMs: FIVE_MINUTES_MS,
  hardLimitMs: SEVEN_DAYS_MS,
  maxItemAttempts: KEY_ROTATION_MAX_ITEM_ATTEMPTS,
} as const;

export const ROTATION_STATES = {
  initiated: "initiated",
  migrating: "migrating",
  sealing: "sealing",
  completed: "completed",
  failed: "failed",
} as const satisfies Record<string, import("./key-rotation.js").RotationState>;

export const ROTATION_ITEM_STATUSES = {
  pending: "pending",
  claimed: "claimed",
  completed: "completed",
  failed: "failed",
} as const satisfies Record<string, import("./key-rotation.js").RotationItemStatus>;

// ── Client-Side Retry Guidance ───────────────────────────────────────

const CLIENT_RETRY_MAX_ATTEMPTS = 3;

export const CLIENT_RETRY = {
  baseDelayMs: MS_PER_SECOND,
  multiplier: 2,
  maxDelayMs: MS_PER_MINUTE,
  maxAttempts: CLIENT_RETRY_MAX_ATTEMPTS,
} as const;
