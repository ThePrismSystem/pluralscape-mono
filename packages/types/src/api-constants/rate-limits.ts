/**
 * Rate limit category constants.
 */

import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "./time-constants.js";

// ── Rate Limits ──────────────────────────────────────────────────────

export interface RateLimitConfig {
  readonly limit: number;
  readonly windowMs: number;
}

const RATE_LIMIT_GLOBAL = 100;
const RATE_LIMIT_AUTH_HEAVY = 5;
const RATE_LIMIT_AUTH_LIGHT = 20;
/**
 * Specification-level default for the device transfer category.
 * The device-transfer route uses purpose-specific rate limiters instead
 * (TRANSFER_INITIATION_LIMIT and MAX_TRANSFER_CODE_ATTEMPTS in their
 * respective modules). Retained for API specification completeness.
 */
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
const RATE_LIMIT_FRIEND_CODE_REDEEM = 5;
const RATE_LIMIT_PUBLIC_API = 60;
const RATE_LIMIT_SSE_STREAM = 5;
const RATE_LIMIT_RECOVERY_ATTEMPT = 3;

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
  friendCodeRedeem: { limit: RATE_LIMIT_FRIEND_CODE_REDEEM, windowMs: MS_PER_MINUTE },
  publicApi: { limit: RATE_LIMIT_PUBLIC_API, windowMs: MS_PER_MINUTE },
  sseStream: { limit: RATE_LIMIT_SSE_STREAM, windowMs: MS_PER_MINUTE },
  recoveryAttempt: { limit: RATE_LIMIT_RECOVERY_ATTEMPT, windowMs: MS_PER_HOUR },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitCategory = keyof typeof RATE_LIMITS;
