import { MS_PER_HOUR, MS_PER_SECOND } from "../api-constants/time-constants.js";

const HOURS_PER_DAY = 24;
const OTA_TIMEOUT_SECONDS = 5;
const ETAG_HEX_CHARS = 16;

/** Valkey TTL for OTA cache entries. */
export const I18N_CACHE_TTL_MS = MS_PER_HOUR * HOURS_PER_DAY;

/** Timeout for a single Crowdin CDN fetch. */
export const I18N_OTA_TIMEOUT_MS = MS_PER_SECOND * OTA_TIMEOUT_SECONDS;

/** Length of the ETag (sha256 hex prefix). */
export const I18N_ETAG_LENGTH = ETAG_HEX_CHARS;
