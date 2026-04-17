/**
 * Sentinel value for `storageFallbackReason` when the OPFS capability
 * check fails before init is attempted (no Worker, no
 * navigator.storage.getDirectory, restrictive context). Distinguishes
 * "not supported" from "init failed: <message>".
 */
export const OPFS_UNAVAILABLE_REASON = "opfs-unavailable";

/**
 * Prefix on `storageFallbackReason` when OPFS was available but init
 * threw. The full reason is `OPFS_INIT_FAILED_PREFIX + ${error.message}`.
 */
export const OPFS_INIT_FAILED_PREFIX = "OPFS init failed: ";
