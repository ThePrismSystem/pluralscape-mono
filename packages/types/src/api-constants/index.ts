export {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  FIVE_MINUTES_MS,
  SEVEN_DAYS_MS,
  THIRTY_DAYS_MS,
  NINETY_DAYS_MS,
  FIVE_MiB,
  TEN_MiB,
  TWENTY_FIVE_MiB,
  FIVE_HUNDRED_MiB,
} from "./time-constants.js";

export type { RateLimitConfig, RateLimitCategory } from "./rate-limits.js";
export { RATE_LIMITS } from "./rate-limits.js";

export type { ApiErrorCode } from "./error-codes.js";
export { API_ERROR_CODES } from "./error-codes.js";

export {
  PAGINATION,
  SESSION_TIMEOUTS,
  LAST_ACTIVE_THROTTLE_MS,
  BLOB_SIZE_LIMITS,
  FRIEND_CODE,
  AUDIT_RETENTION,
  KEY_ROTATION,
  ROTATION_STATES,
  ROTATION_ITEM_STATUSES,
  CLIENT_RETRY,
} from "./api-limits.js";
