/**
 * API operational limits: pagination, sessions, media, friend codes,
 * audit retention, key rotation, and client-side retry guidance.
 */

import {
  FIVE_HUNDRED_MiB,
  FIVE_MiB,
  FIVE_MINUTES_MS,
  MS_PER_DAY,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  NINETY_DAYS_MS,
  SEVEN_DAYS_MS,
  TEN_MiB,
  THIRTY_DAYS_MS,
  TWENTY_FIVE_MiB,
} from "./time-constants.js";

import type { BlobPurpose } from "../blob.js";
import type { RotationItemStatus, RotationState } from "../key-rotation.js";

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
} as const satisfies Record<string, RotationState>;

export const ROTATION_ITEM_STATUSES = {
  pending: "pending",
  claimed: "claimed",
  completed: "completed",
  failed: "failed",
} as const satisfies Record<string, RotationItemStatus>;

// ── Client-Side Retry Guidance ───────────────────────────────────────

const CLIENT_RETRY_MAX_ATTEMPTS = 3;

export const CLIENT_RETRY = {
  baseDelayMs: MS_PER_SECOND,
  multiplier: 2,
  maxDelayMs: MS_PER_MINUTE,
  maxAttempts: CLIENT_RETRY_MAX_ATTEMPTS,
} as const;
